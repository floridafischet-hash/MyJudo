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
import { PermissionService } from '../rbac/permission.service';
import { Invitation } from '../invitations/invitation.entity';
import { hashInvitationToken } from '../invitations/invitations.service';
import { Role } from '../rbac/role.entity';
import { UserRole } from '../rbac/user-role.entity';
import { Member } from '../members/member.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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

  async register(dto: RegisterDto): Promise<{ id: string; status: UserStatus }> {
    const organization = await this.organizations.findOneBy({
      slug: dto.organizationSlug,
      active: true,
    });
    if (!organization) {
      throw new ConflictException('Registrierung für diesen Verein ist nicht verfügbar.');
    }
    const email = normalizeEmail(dto.email);
    const passwordHash = await this.passwords.hash(dto.password);
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(User).findOne({
        where: { organizationId: organization.id, email },
        withDeleted: true,
      });
      if (existing) {
        throw new ConflictException('Für diese E-Mail-Adresse besteht bereits eine Registrierung.');
      }
      let invitation: Invitation | null = null;
      if (dto.invitationToken) {
        invitation = await manager.getRepository(Invitation).findOne({
          where: {
            organizationId: organization.id,
            tokenHash: hashInvitationToken(dto.invitationToken),
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !invitation ||
          invitation.usedAt ||
          invitation.revokedAt ||
          invitation.expiresAt <= new Date() ||
          (invitation.email !== null && invitation.email !== email)
        ) {
          throw new ConflictException('Die Einladung ist ungültig oder nicht mehr verwendbar.');
        }
      }
      const approved = invitation !== null;
      const saved = await manager.getRepository(User).save({
        organizationId: organization.id,
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        status: approved ? UserStatus.Approved : UserStatus.Pending,
        approvedAt: approved ? new Date() : null,
        approvedBy: invitation?.invitedBy ?? null,
      });
      if (invitation) {
        const memberRole = await manager.getRepository(Role).findOneBy({
          organizationId: organization.id,
          name: 'Mitglied / Eltern',
        });
        if (!memberRole) throw new Error('Default member role is missing');
        await manager.getRepository(UserRole).save({
          userId: saved.id,
          roleId: memberRole.id,
          assignedBy: invitation.invitedBy,
        });
        if (invitation.memberNumber) {
          const member = await manager.getRepository(Member).findOne({
            where: {
              organizationId: organization.id,
              memberNumber: invitation.memberNumber,
            },
            lock: { mode: 'pessimistic_write' },
          });
          if (!member || member.userId) {
            throw new ConflictException(
              'Die Einladung kann keinem freien Mitgliedsdatensatz zugeordnet werden.',
            );
          }
          member.userId = saved.id;
          await manager.getRepository(Member).save(member);
        }
        invitation.usedAt = new Date();
        invitation.usedBy = saved.id;
        await manager.getRepository(Invitation).save(invitation);
      }
      await manager.getRepository(AuditLog).save({
        organizationId: organization.id,
        actorUserId: saved.id,
        action: invitation ? 'invitation.accepted' : 'user.registered',
        entityType: 'user',
        entityId: saved.id,
        outcome: 'success',
        metadata: invitation ? { invitationId: invitation.id } : null,
      });
      return { id: saved.id, status: saved.status };
    });
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
          .where('"user"."organizationId" = :organizationId', {
            organizationId: organization.id,
          })
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
        permissions: await this.permissions.listForUser(user.id, user.organizationId),
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
      permissions: await this.permissions.listForUser(user.id, user.organizationId),
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
