import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Invitation } from './invitation.entity';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { Role } from '../rbac/role.entity';
import { UserRole } from '../rbac/user-role.entity';
import { Member } from '../members/member.entity';
import { ConflictException } from '@nestjs/common';

@Injectable()
export class InvitationsService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateInvitationDto,
  ): Promise<{ id: string; token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(Invitation).save({
        organizationId: actor.organizationId,
        tokenHash: hashInvitationToken(token),
        email: dto.email?.trim().toLocaleLowerCase('en-US') ?? null,
        memberNumber: dto.memberNumber?.trim() ?? null,
        expiresAt: new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000),
        usedAt: null,
        usedBy: null,
        revokedAt: null,
        invitedBy: actor.id,
      });
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'invitation.created',
        entityType: 'invitation',
        entityId: saved.id,
        outcome: 'success',
        metadata: { expiresAt: saved.expiresAt, emailRestricted: saved.email !== null },
      });
      return saved;
    });
    return { id: invitation.id, token, expiresAt: invitation.expiresAt };
  }

  async revoke(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const invitation = await manager.getRepository(Invitation).findOne({
        where: { id, organizationId: actor.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invitation) throw new NotFoundException('Einladung wurde nicht gefunden.');
      invitation.revokedAt ??= new Date();
      await manager.getRepository(Invitation).save(invitation);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'invitation.revoked',
        entityType: 'invitation',
        entityId: invitation.id,
        outcome: 'success',
        metadata: null,
      });
    });
  }

  async accept(actor: AuthenticatedUser, token: string): Promise<{ status: string }> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: actor.id, organizationId: actor.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.status !== UserStatus.Pending) {
        throw new ConflictException('Das Benutzerkonto kann diese Einladung nicht verwenden.');
      }
      const invitation = await manager.getRepository(Invitation).findOne({
        where: {
          organizationId: actor.organizationId,
          tokenHash: hashInvitationToken(token),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !invitation ||
        invitation.usedAt ||
        invitation.revokedAt ||
        invitation.expiresAt <= new Date() ||
        (invitation.email !== null && invitation.email !== user.email)
      ) {
        throw new ConflictException('Die Einladung ist ungültig oder nicht mehr verwendbar.');
      }
      const memberRole = await manager.getRepository(Role).findOneBy({
        organizationId: actor.organizationId,
        name: 'Mitglied / Eltern',
      });
      if (!memberRole) throw new Error('Default member role is missing');
      await manager.getRepository(UserRole).save({
        userId: user.id,
        roleId: memberRole.id,
        assignedBy: invitation.invitedBy,
      });
      if (invitation.memberNumber) {
        const member = await manager.getRepository(Member).findOne({
          where: {
            organizationId: actor.organizationId,
            memberNumber: invitation.memberNumber,
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (!member || member.userId) {
          throw new ConflictException(
            'Die Einladung kann keinem freien Mitgliedsdatensatz zugeordnet werden.',
          );
        }
        member.userId = user.id;
        await manager.getRepository(Member).save(member);
      }
      user.status = UserStatus.Approved;
      user.approvedAt = new Date();
      user.approvedBy = invitation.invitedBy;
      await manager.getRepository(User).save(user);
      invitation.usedAt = new Date();
      invitation.usedBy = user.id;
      await manager.getRepository(Invitation).save(invitation);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: user.id,
        action: 'invitation.accepted',
        entityType: 'invitation',
        entityId: invitation.id,
        outcome: 'success',
        metadata: null,
      });
      return { status: user.status };
    });
  }
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
