import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Invitation } from './invitation.entity';

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
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
