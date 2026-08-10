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
}

export interface UserProfile {
  id: string;
  username: string;
  firstName: string | null;
  displayName: string | null;
  permissions: string[];
}

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds: number;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly permissions: PermissionService,
  ) {
    this.accessTtlSeconds = parseDurationSeconds(config.get<string>('JWT_ACCESS_TTL') ?? '15m');
  }

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
          .andWhere("lower(split_part(user.email, '@', 1)) = :username", {
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
      const user = await manager.getRepository(User).findOneBy({ id: session.userId });
      if (!user || user.status !== UserStatus.Approved) {
        session.revokedAt = new Date();
        await sessions.save(session);
        throw new UnauthorizedException('Sitzung ist ungültig oder abgelaufen.');
      }
      const nextRefreshToken = randomBytes(48).toString('base64url');
      session.refreshTokenHash = hashToken(nextRefreshToken);
      await sessions.save(session);
      return this.tokenPair(user, nextRefreshToken);
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
    await this.sessions.save({
      organizationId: user.organizationId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      userAgent: context.userAgent?.slice(0, 500) ?? null,
      ipAddress: context.ipAddress ?? null,
    });
    return this.tokenPair(user, refreshToken);
  }

  private async tokenPair(user: User, refreshToken: string): Promise<TokenPair> {
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
      expiresIn: this.accessTtlSeconds,
      userId: user.id,
      ...(await this.userDetails(user)),
    };
  }

  private async userDetails(user: User) {
    return {
      permissions: await this.permissions.listForUser(user.id, user.organizationId),
      username: user.email.split('@')[0] ?? user.email,
      firstName: user.firstName.trim() || null,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
    };
  }

  private signAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      org: user.organizationId,
      av: user.authorizationVersion,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.accessTtlSeconds,
      issuer: 'myjudo-api',
      audience: 'myjudo-client',
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error('JWT_ACCESS_TTL must use s, m, h or d notation');
  const factors = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  return Number.parseInt(match[1] ?? '', 10) * factors[match[2] as keyof typeof factors];
}
