import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from './auth.types';
import { Session } from './session.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
  ) {
    this.accessTtlSeconds = parseDurationSeconds(config.get<string>('JWT_ACCESS_TTL') ?? '15m');
  }

  async register(dto: RegisterDto): Promise<{ id: string; status: UserStatus }> {
    const organization = await this.organizations.findOneBy({
      slug: dto.organizationSlug,
      active: true,
    });
    if (!organization) {
      throw new ConflictException('Registrierung für diesen Verein ist nicht verfügbar.');
    }
    const email = normalizeEmail(dto.email);
    const existing = await this.users.findOne({
      where: { organizationId: organization.id, email },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException('Für diese E-Mail-Adresse besteht bereits eine Registrierung.');
    }

    const user = this.users.create({
      organizationId: organization.id,
      email,
      passwordHash: await this.passwords.hash(dto.password),
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      status: UserStatus.Pending,
      approvedAt: null,
      approvedBy: null,
    });
    const saved = await this.users.save(user);
    await this.dataSource.getRepository(AuditLog).save({
      organizationId: organization.id,
      actorUserId: saved.id,
      action: 'user.registered',
      entityType: 'user',
      entityId: saved.id,
      outcome: 'success',
      metadata: null,
    });
    return { id: saved.id, status: saved.status };
  }

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    const organization = await this.organizations.findOneBy({
      slug: dto.organizationSlug,
      active: true,
    });
    const user = organization
      ? await this.users.findOneBy({
          organizationId: organization.id,
          email: normalizeEmail(dto.email),
        })
      : null;
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Anmeldung fehlgeschlagen.');
    }
    if (user.status !== UserStatus.Approved) {
      throw new UnauthorizedException('Das Benutzerkonto ist noch nicht freigeschaltet.');
    }
    return this.issueTokenPair(user, context);
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawRefreshToken);
    return this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(Session);
      const session = await sessionRepository.findOne({
        where: { refreshTokenHash: tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Sitzung ist ungültig oder abgelaufen.');
      }
      const user = await manager.getRepository(User).findOneBy({ id: session.userId });
      if (!user || user.status !== UserStatus.Approved) {
        session.revokedAt = new Date();
        await sessionRepository.save(session);
        throw new UnauthorizedException('Sitzung ist ungültig oder abgelaufen.');
      }
      const nextRefreshToken = randomBytes(48).toString('base64url');
      session.refreshTokenHash = hashToken(nextRefreshToken);
      await sessionRepository.save(session);
      return {
        accessToken: await this.signAccessToken(user),
        refreshToken: nextRefreshToken,
        expiresIn: this.accessTtlSeconds,
      };
    });
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.sessions.update(
      { refreshTokenHash: hashToken(rawRefreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueTokenPair(
    user: User,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.sessions.save(
      this.sessions.create({
        organizationId: user.organizationId,
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        userAgent: context.userAgent?.slice(0, 500) ?? null,
        ipAddress: context.ipAddress ?? null,
      }),
    );
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
      expiresIn: this.accessTtlSeconds,
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

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error('JWT_ACCESS_TTL must use s, m, h or d notation');
  const amount = Number.parseInt(match[1] ?? '', 10);
  const factors = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  return amount * factors[match[2] as keyof typeof factors];
}
