import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { PermissionService } from '../rbac/permission.service';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';
import { Session } from './session.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  permissions: string[];
  userId: string;
  username: string;
  firstName: string | null;
  displayName: string | null;
  isSuperuser: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  firstName: string | null;
  displayName: string | null;
  permissions: string[];
  isSuperuser: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly permissions: PermissionService,
  ) {}

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    const organization = await this.organizations.findOneBy({
      slug: this.config.getOrThrow<string>('INITIAL_ORGANIZATION_SLUG'),
      active: true,
    });
    const users = organization
      ? await this.users
          .createQueryBuilder('user')
          .where('"user"."organizationId" = :organizationId', { organizationId: organization.id })
          .andWhere('"user"."deletedAt" IS NULL')
          .andWhere('lower(user.username) = :username', {
            username: dto.username.trim().toLocaleLowerCase('en-US'),
          })
          .take(2)
          .getMany()
      : [];
    const user = users.length === 1 ? users[0] : null;
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Anmeldung fehlgeschlagen.');
    }
    if (user.status !== UserStatus.Approved) {
      throw new UnauthorizedException('Das Benutzerkonto ist noch nicht freigeschaltet.');
    }
    return this.issueTokenPair(user, context);
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    return this.dataSource.transaction(async (manager) => {
      const sessions = manager.getRepository(Session);
      const session = await sessions.findOne({
        where: { refreshTokenHash: hashToken(rawRefreshToken) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Sitzung ist ungültig oder abgelaufen.');
      }
      const cutoff = nextBerlinSessionCutoff();
      // Sessions created before the daily-cutoff policy must not survive into
      // another club day. A fresh login establishes the new daily session.
      if (session.expiresAt.getTime() > cutoff.getTime() + 1_000) {
        session.revokedAt = new Date();
        await sessions.save(session);
        throw new UnauthorizedException('Bitte melde dich einmal neu an.');
      }
      const user = await manager.getRepository(User).findOneBy({ id: session.userId });
      if (!user || user.status !== UserStatus.Approved) {
        session.revokedAt = new Date();
        await sessions.save(session);
        throw new UnauthorizedException('Sitzung ist ungültig oder abgelaufen.');
      }
      const nextRefreshToken = randomBytes(48).toString('base64url');
      session.refreshTokenHash = hashToken(nextRefreshToken);
      await sessions.save(session);
      return this.tokenPair(user, nextRefreshToken, session.expiresAt);
    });
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.sessions.update(
      { refreshTokenHash: hashToken(rawRefreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async profile(actor: AuthenticatedUser): Promise<UserProfile> {
    const user = await this.users.findOneBy({ id: actor.id, organizationId: actor.organizationId });
    if (!user || user.status !== UserStatus.Approved) throw new UnauthorizedException();
    const details = await this.userDetails(user);
    return { id: user.id, ...details };
  }

  private async issueTokenPair(
    user: User,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = nextBerlinSessionCutoff();
    await this.sessions.save({
      organizationId: user.organizationId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
      revokedAt: null,
      userAgent: context.userAgent?.slice(0, 500) ?? null,
      ipAddress: context.ipAddress ?? null,
    });
    return this.tokenPair(user, refreshToken, expiresAt);
  }

  private async tokenPair(user: User, refreshToken: string, expiresAt: Date): Promise<TokenPair> {
    const expiresIn = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1_000));
    return {
      accessToken: await this.signAccessToken(user, expiresIn),
      refreshToken,
      expiresIn,
      userId: user.id,
      ...(await this.userDetails(user)),
    };
  }

  private async userDetails(user: User) {
    return {
      permissions: await this.permissions.listForUser(user.id, user.organizationId),
      isSuperuser: await this.permissions.hasRole(user.id, user.organizationId, 'Superuser'),
      username: user.username,
      firstName: user.firstName.trim() || null,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
    };
  }

  private signAccessToken(user: User, expiresIn: number): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      org: user.organizationId,
      av: user.authorizationVersion,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn,
      issuer: 'myjudo-api',
      audience: 'myjudo-client',
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function nextBerlinSessionCutoff(now = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number.parseInt(part.value, 10)]),
  );
  const localDay = new Date(
    Date.UTC(
      readDatePart(parts, 'year'),
      readDatePart(parts, 'month') - 1,
      readDatePart(parts, 'day'),
    ),
  );
  if (readDatePart(parts, 'hour') >= 23) localDay.setUTCDate(localDay.getUTCDate() + 1);

  // 23:00 never lies in the DST transition gap. Resolve the Berlin offset
  // iteratively so summer and winter time are both handled without host-TZ assumptions.
  const localTarget = Date.UTC(
    localDay.getUTCFullYear(),
    localDay.getUTCMonth(),
    localDay.getUTCDate(),
    23,
  );
  let utcTarget = localTarget;
  for (let index = 0; index < 2; index += 1) {
    const targetParts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(utcTarget))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number.parseInt(part.value, 10)]),
    );
    const representedLocal = Date.UTC(
      readDatePart(targetParts, 'year'),
      readDatePart(targetParts, 'month') - 1,
      readDatePart(targetParts, 'day'),
      readDatePart(targetParts, 'hour'),
      readDatePart(targetParts, 'minute'),
      readDatePart(targetParts, 'second'),
    );
    utcTarget -= representedLocal - localTarget;
  }
  return new Date(utcTarget);
}

function readDatePart(parts: Record<string, number>, name: string): number {
  const value = parts[name];
  if (value === undefined) throw new Error(`Missing date part: ${name}`);
  return value;
}
