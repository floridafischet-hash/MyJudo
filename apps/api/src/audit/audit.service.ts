import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionService } from '../rbac/permission.service';

export interface AuditQuery {
  from?: string;
  until?: string;
  actorUserId?: string;
  action?: string;
  area?: string;
  search?: string;
  limit?: string;
}

export interface AuditLogView {
  id: string;
  createdAt: Date;
  actorUserId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: 'success' | 'failure';
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly permissions: PermissionService,
  ) {}

  async list(actor: AuthenticatedUser, query: AuditQuery): Promise<AuditLogView[]> {
    if (!(await this.permissions.hasRole(actor.id, actor.organizationId, 'Superuser'))) {
      throw new ForbiddenException('Systemlogs sind ausschließlich für Superuser sichtbar.');
    }
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 250);
    const values: unknown[] = [actor.organizationId];
    const where = ['a."organizationId" = $1'];
    const add = (condition: string, value: unknown) => {
      values.push(value);
      where.push(condition.replace('?', `$${values.length}`));
    };
    if (query.from) add('a."createdAt" >= ?::timestamptz', query.from);
    if (query.until) add('a."createdAt" < ?::timestamptz', query.until);
    if (query.actorUserId) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          query.actorUserId,
        )
      ) {
        throw new BadRequestException('Ungültiger Benutzerfilter.');
      }
      add('a."actorUserId" = ?::uuid', query.actorUserId);
    }
    if (query.action?.trim()) add('a.action = ?', query.action.trim());
    if (query.area?.trim()) add('a."entityType" = ?', query.area.trim());
    if (query.search?.trim()) {
      add(
        `CONCAT_WS(' ', a.action, a."entityType", a.metadata::text, u."firstName", u."lastName", u.email) ILIKE '%' || ? || '%'`,
        query.search.trim(),
      );
    }
    values.push(limit);
    return this.dataSource.query<AuditLogView[]>(
      `SELECT a.id, a."createdAt", a."actorUserId", a.action, a."entityType", a."entityId", a.outcome, a.metadata,
        COALESCE(NULLIF(TRIM(u."firstName" || ' ' || u."lastName"), ''), u.email, 'System') AS "actorName"
       FROM audit_logs a LEFT JOIN users u ON u.id = a."actorUserId"
       WHERE ${where.join(' AND ')} ORDER BY a."createdAt" DESC, a.id DESC LIMIT $${values.length}`,
      values,
    );
  }
}
