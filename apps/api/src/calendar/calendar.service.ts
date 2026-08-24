import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionService } from '../rbac/permission.service';
import { CalendarEvent } from './calendar-event.entity';
import { SaveCalendarEventDto } from './dto/calendar-event.dto';

@Injectable()
export class CalendarService {
  constructor(
    private readonly data: DataSource,
    @InjectRepository(CalendarEvent) private readonly events: Repository<CalendarEvent>,
    private readonly permissions: PermissionService,
  ) {}

  async list(actor: AuthenticatedUser, from: string, until: string) {
    const start = new Date(from),
      end = new Date(until);
    if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || end <= start)
      throw new BadRequestException('Ungültiger Zeitraum.');
    const superuser = await this.permissions.hasRole(actor.id, actor.organizationId, 'Superuser');
    return this.data.query(
      `SELECT e.*,
        COALESCE(
          (SELECT g.color FROM groups g WHERE g.id = e."groupIds"[1]),
          (SELECT u.color FROM users u WHERE cardinality(e."groupIds") = 0
            AND cardinality(e."participantIds") = 1 AND u.id = e."participantIds"[1])
        ) AS color
       FROM calendar_events e WHERE e."organizationId"=$1 AND e."deletedAt" IS NULL AND e."startsAt">=$2 AND e."startsAt"<$3
       AND ($4::boolean OR e."createdBy"=$5 OR $5=ANY(e."participantIds") OR cardinality(e."groupIds")=0 OR EXISTS(SELECT 1 FROM user_groups ug WHERE ug."userId"=$5 AND ug."groupId"=ANY(e."groupIds"))) ORDER BY e."startsAt"`,
      [actor.organizationId, start, end, superuser, actor.id],
    );
  }

  async recentActivity(actor: AuthenticatedUser) {
    return this.data.query(
      `SELECT a.id,a.action,a."entityType",a."entityId",a.metadata,a."createdAt",
        COALESCE(NULLIF(trim(concat(u."firstName",' ',u."lastName")),''),'System') AS "actorName"
       FROM audit_logs a LEFT JOIN users u ON u.id=a."actorUserId"
       WHERE a."organizationId"=$1 AND a.outcome='success'
         AND a.action ~ '(project|calendar|training|download|chat|checklist|card)'
       ORDER BY a."createdAt" DESC LIMIT 10`,
      [actor.organizationId],
    );
  }

  async create(actor: AuthenticatedUser, dto: SaveCalendarEventDto) {
    await this.validateReferences(actor, dto);
    const starts = new Date(dto.startsAt),
      ends = new Date(dto.endsAt);
    if (ends <= starts)
      throw new BadRequestException('Die Endzeit muss nach der Startzeit liegen.');
    const recurrence = dto.recurrence ?? 'none';
    const seriesId = recurrence === 'none' ? null : randomUUID();
    const occurrences = this.occurrences(
      starts,
      ends,
      recurrence,
      dto.recurrenceInterval ?? 1,
      dto.recurrenceUntil,
      dto.recurrenceCount,
    );
    return this.data.transaction(async (manager) => {
      const saved = await manager.getRepository(CalendarEvent).save(
        occurrences.map(([s, e]) =>
          manager.getRepository(CalendarEvent).create({
            organizationId: actor.organizationId,
            createdBy: actor.id,
            seriesId,
            title: dto.title.trim(),
            description: dto.description?.trim() || null,
            startsAt: s,
            endsAt: e,
            location: dto.location?.trim() || null,
            eventType: dto.eventType?.trim() || 'event',
            groupIds: dto.groupIds ?? [],
            participantIds: dto.participantIds ?? [],
            reminderMinutes: dto.reminderMinutes ?? null,
            recurrence,
            recurrenceInterval: dto.recurrenceInterval ?? 1,
            recurrenceUntil: dto.recurrenceUntil?.substring(0, 10) ?? null,
            recurrenceCount: dto.recurrenceCount ?? null,
          }),
        ),
      );
      const first = saved[0]!;
      await this.audit(manager, actor, 'calendar.event.created', first.id, {
        title: dto.title,
        seriesId,
        occurrences: saved.length,
      });
      return first;
    });
  }

  async update(actor: AuthenticatedUser, id: string, dto: SaveCalendarEventDto, scope: string) {
    const current = await this.manageable(actor, id);
    await this.validateReferences(actor, dto);
    const starts = new Date(dto.startsAt),
      ends = new Date(dto.endsAt);
    if (ends <= starts)
      throw new BadRequestException('Die Endzeit muss nach der Startzeit liegen.');
    const targets = await this.targets(current, scope);
    const delta = starts.valueOf() - current.startsAt.valueOf();
    const duration = ends.valueOf() - starts.valueOf();
    await this.data.transaction(async (manager) => {
      for (const [index, target] of targets.entries()) {
        target.title = dto.title.trim();
        target.description = dto.description?.trim() || null;
        target.location = dto.location?.trim() || null;
        target.eventType = dto.eventType || 'event';
        target.groupIds = dto.groupIds ?? [];
        target.participantIds = dto.participantIds ?? [];
        target.reminderMinutes = dto.reminderMinutes ?? null;
        if (index === 0 || scope !== 'single') {
          target.startsAt = new Date(target.startsAt.valueOf() + delta);
          target.endsAt = new Date(target.startsAt.valueOf() + duration);
        }
      }
      await manager.getRepository(CalendarEvent).save(targets);
      await this.audit(manager, actor, 'calendar.event.updated', id, { title: dto.title, scope });
    });
    return this.events.findOneByOrFail({ id });
  }

  async copy(actor: AuthenticatedUser, id: string, dto: SaveCalendarEventDto) {
    await this.manageable(actor, id);
    return this.create(actor, { ...dto, recurrence: 'none' });
  }
  async remove(actor: AuthenticatedUser, id: string, scope: string) {
    const current = await this.manageable(actor, id);
    const targets = await this.targets(current, scope);
    await this.data.transaction(async (manager) => {
      await manager.getRepository(CalendarEvent).softRemove(targets);
      await this.audit(manager, actor, 'calendar.event.deleted', id, {
        title: current.title,
        scope,
        count: targets.length,
      });
    });
  }
  async ics(actor: AuthenticatedUser, id: string) {
    const event = await this.visible(actor, id);
    const esc = (v: string) => v.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const dt = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyJudo//Kalender//DE\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:${event.id}@myjudo\r\nDTSTAMP:${dt(new Date())}\r\nDTSTART:${dt(event.startsAt)}\r\nDTEND:${dt(event.endsAt)}\r\nSUMMARY:${esc(event.title)}\r\nDESCRIPTION:${esc(event.description ?? '')}\r\nLOCATION:${esc(event.location ?? '')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  }

  private async visible(actor: AuthenticatedUser, id: string) {
    const rows = await this.list(actor, '1970-01-01T00:00:00Z', '2200-01-01T00:00:00Z');
    const event = rows.find((x: any) => x.id === id);
    if (!event) throw new NotFoundException('Termin wurde nicht gefunden.');
    return event as CalendarEvent;
  }
  private async manageable(actor: AuthenticatedUser, id: string) {
    const event = await this.events.findOneBy({ id, organizationId: actor.organizationId });
    if (!event) throw new NotFoundException('Termin wurde nicht gefunden.');
    const superuser = await this.permissions.hasRole(actor.id, actor.organizationId, 'Superuser');
    const manage = await this.permissions.hasAll(actor.id, actor.organizationId, [
      'training.manage',
    ]);
    if (!superuser && !manage && event.createdBy !== actor.id) throw new ForbiddenException();
    return event;
  }
  private async targets(current: CalendarEvent, scope: string) {
    if (!current.seriesId || scope === 'single') return [current];
    const qb = this.events
      .createQueryBuilder('e')
      .where('e.seriesId=:seriesId AND e.deletedAt IS NULL', { seriesId: current.seriesId });
    if (scope === 'future') qb.andWhere('e.startsAt>=:start', { start: current.startsAt });
    return qb.orderBy('e.startsAt', 'ASC').getMany();
  }
  private occurrences(
    start: Date,
    end: Date,
    type: string,
    interval: number,
    until?: string,
    count?: number,
  ) {
    const out: Array<[Date, Date]> = [];
    const limit = count ?? (type === 'none' ? 1 : 500);
    const max = until ? new Date(`${until.substring(0, 10)}T23:59:59.999Z`) : null;
    let s = new Date(start),
      e = new Date(end);
    while (out.length < limit && (!max || s <= max)) {
      out.push([new Date(s), new Date(e)]);
      if (type === 'none') break;
      const next = new Date(s);
      if (type === 'daily') next.setUTCDate(next.getUTCDate() + interval);
      if (type === 'weekly') next.setUTCDate(next.getUTCDate() + 7 * interval);
      if (type === 'biweekly') next.setUTCDate(next.getUTCDate() + 14 * interval);
      if (type === 'monthly') next.setUTCMonth(next.getUTCMonth() + interval);
      if (type === 'yearly') next.setUTCFullYear(next.getUTCFullYear() + interval);
      const diff = next.valueOf() - s.valueOf();
      s = next;
      e = new Date(e.valueOf() + diff);
    }
    if (type !== 'none' && !until && !count)
      throw new BadRequestException('Für Serien ist ein Enddatum oder eine Anzahl erforderlich.');
    return out;
  }
  private async validateReferences(actor: AuthenticatedUser, dto: SaveCalendarEventDto) {
    for (const [table, ids] of [
      ['groups', dto.groupIds ?? []],
      ['users', dto.participantIds ?? []],
    ] as const) {
      if (!ids.length) continue;
      const rows = await this.data.query(
        `SELECT id FROM ${table} WHERE "organizationId"=$1 AND "deletedAt" IS NULL AND id=ANY($2::uuid[])`,
        [actor.organizationId, ids],
      );
      if (rows.length !== new Set(ids).size)
        throw new BadRequestException('Mindestens eine Zuordnung ist ungültig.');
    }
  }
  private audit(manager: any, actor: AuthenticatedUser, action: string, id: string, metadata: any) {
    return manager
      .getRepository(AuditLog)
      .save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action,
        entityType: 'calendar_event',
        entityId: id,
        outcome: 'success',
        metadata,
      });
  }
}
