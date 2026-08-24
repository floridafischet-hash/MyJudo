import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { autoColorFor } from '../common/color-palette';
import { deleteImage, readImage, resolveImageUpload, storeImage } from '../common/image-upload';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { Attendance, AttendanceStatus } from './attendance.entity';
import {
  CreateGroupDto,
  CreateScheduleDto,
  CreateSessionDto,
  UpdateSessionDto,
} from './dto/training.dto';
import { Group } from './group.entity';
import { TrainingGroup } from './training-group.entity';
import { TrainingSchedule } from './training-schedule.entity';
import { TrainingSession } from './training-session.entity';
import { UserGroup } from './user-group.entity';

export interface SessionView {
  id: string;
  scheduleId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  cancelled: boolean;
  locked: boolean;
  groups: Array<{ id: string; name: string; color: string | null }>;
  attendance: null | { status: AttendanceStatus; respondedAt: Date; updatedAt: Date };
}
interface SessionRow {
  id: string;
  scheduleId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  cancelled: boolean;
  status: AttendanceStatus | null;
  respondedAt: Date | null;
  updatedAt: Date | null;
  groups: Array<{ id: string; name: string; color: string | null }> | null;
}
interface AttendanceRow {
  id: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus | null;
  updatedAt: Date | null;
}
export interface ScheduleView extends TrainingSchedule {
  groups: Array<{ id: string; name: string; color: string | null }>;
}

@Injectable()
export class TrainingService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(TrainingSchedule) private readonly schedules: Repository<TrainingSchedule>,
    private readonly config: ConfigService,
  ) {}

  private avatarRoot(): string {
    return this.config.get<string>('AVATAR_STORAGE_PATH') ?? '/app/data/avatars';
  }

  async uploadGroupAvatar(actor: AuthenticatedUser, id: string, file: Express.Multer.File) {
    const group = await this.groupForAdmin(actor, id);
    const { mime, extension } = resolveImageUpload(file, 5 * 1024 * 1024);
    const stored = await storeImage(this.avatarRoot(), file.buffer, extension);
    const previous = group.avatarStoredName;
    group.avatarStoredName = stored;
    group.avatarMimeType = mime;
    await this.groups.save(group);
    await deleteImage(this.avatarRoot(), previous);
    return { id: group.id };
  }

  async deleteGroupAvatar(actor: AuthenticatedUser, id: string) {
    const group = await this.groupForAdmin(actor, id);
    const previous = group.avatarStoredName;
    group.avatarStoredName = null;
    group.avatarMimeType = null;
    await this.groups.save(group);
    await deleteImage(this.avatarRoot(), previous);
  }

  async groupAvatar(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<{ mime: string; buffer: Buffer }> {
    const group = await this.groups.findOneBy({ id, organizationId: actor.organizationId });
    if (!group?.avatarStoredName || !group.avatarMimeType)
      throw new NotFoundException('Bild wurde nicht gefunden.');
    return {
      mime: group.avatarMimeType,
      buffer: await readImage(this.avatarRoot(), group.avatarStoredName),
    };
  }

  listGroups(actor: AuthenticatedUser): Promise<Group[]> {
    return this.groups.find({
      where: { organizationId: actor.organizationId },
      order: { name: 'ASC' },
    });
  }

  async createGroup(actor: AuthenticatedUser, dto: CreateGroupDto): Promise<Group> {
    this.validateAges(dto.minimumAge, dto.maximumAge);
    try {
      const group = await this.groups.save(
        this.groups.create({
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          minimumAge: dto.minimumAge ?? null,
          maximumAge: dto.maximumAge ?? null,
          active: dto.active ?? true,
          color: dto.color ?? autoColorFor(dto.name),
        }),
      );
      await this.audit(actor, 'group.created', 'group', group.id, { name: group.name });
      return group;
    } catch (error) {
      this.rethrowUnique(error, 'Eine Gruppe mit diesem Namen existiert bereits.');
    }
  }

  async updateGroup(actor: AuthenticatedUser, id: string, dto: CreateGroupDto): Promise<Group> {
    this.validateAges(dto.minimumAge, dto.maximumAge);
    const group = await this.groupForAdmin(actor, id);
    Object.assign(group, {
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      minimumAge: dto.minimumAge ?? null,
      maximumAge: dto.maximumAge ?? null,
      active: dto.active ?? true,
      color: dto.color ?? group.color ?? autoColorFor(dto.name),
    });
    try {
      const saved = await this.groups.save(group);
      await this.audit(actor, 'group.updated', 'group', saved.id, { name: saved.name });
      return saved;
    } catch (error) {
      this.rethrowUnique(error, 'Eine Gruppe mit diesem Namen existiert bereits.');
    }
  }

  async deleteGroup(actor: AuthenticatedUser, id: string): Promise<void> {
    const group = await this.groupForAdmin(actor, id);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Group).softRemove(group);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'group.deleted',
        entityType: 'group',
        entityId: id,
        outcome: 'success',
        metadata: { name: group.name },
      });
    });
  }

  async adminUsers(actor: AuthenticatedUser): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT u.id, u.email, u."firstName", u."lastName", u.status, u.color, u."avatarStoredName", m."birthDate",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'color',g.color) ORDER BY g.name)
          FROM user_groups ug JOIN groups g ON g.id=ug."groupId" AND g."deletedAt" IS NULL
          WHERE ug."userId"=u.id), '[]'::jsonb) groups,
        COALESCE((SELECT jsonb_agg(r.name ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id=ur."roleId" WHERE ur."userId"=u.id), '[]'::jsonb) roles
       FROM users u LEFT JOIN members m ON m."userId"=u.id AND m."deletedAt" IS NULL
       WHERE u."organizationId"=$1 AND u."deletedAt" IS NULL ORDER BY u."lastName",u."firstName"`,
      [actor.organizationId],
    );
  }

  async replaceUserGroups(
    actor: AuthenticatedUser,
    userId: string,
    groupIds: string[],
  ): Promise<unknown> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId, organizationId: actor.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Benutzer wurde nicht gefunden.');
      const uniqueIds = [...new Set(groupIds)];
      const groups = uniqueIds.length
        ? await manager
            .getRepository(Group)
            .find({ where: { id: In(uniqueIds), organizationId: actor.organizationId } })
        : [];
      if (groups.length !== uniqueIds.length)
        throw new NotFoundException('Mindestens eine Gruppe wurde nicht gefunden.');
      await manager.getRepository(UserGroup).delete({ userId });
      if (groups.length)
        await manager
          .getRepository(UserGroup)
          .insert(groups.map((group) => ({ userId, groupId: group.id, assignedBy: actor.id })));
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.groups.replaced',
        entityType: 'user',
        entityId: userId,
        outcome: 'success',
        metadata: { groupIds: uniqueIds.sort() },
      });
      return {
        userId,
        groups: groups
          .map(({ id, name }) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
  }

  async listSchedules(actor: AuthenticatedUser): Promise<ScheduleView[]> {
    const rows: ScheduleView[] = await this.dataSource.query(
      `SELECT s.*, COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'color',g.color) ORDER BY g.name) FILTER (WHERE g.id IS NOT NULL),'[]'::jsonb) groups
       FROM training_schedules s LEFT JOIN training_groups tg ON tg."trainingScheduleId"=s.id
       LEFT JOIN groups g ON g.id=tg."groupId" AND g."deletedAt" IS NULL
       WHERE s."organizationId"=$1 AND s."deletedAt" IS NULL GROUP BY s.id ORDER BY s.weekday,s."startTime"`,
      [actor.organizationId],
    );
    return rows;
  }

  createSchedule(actor: AuthenticatedUser, dto: CreateScheduleDto): Promise<unknown> {
    return this.saveSchedule(actor, null, dto);
  }
  updateSchedule(actor: AuthenticatedUser, id: string, dto: CreateScheduleDto): Promise<unknown> {
    return this.saveSchedule(actor, id, dto);
  }

  async setScheduleActive(actor: AuthenticatedUser, id: string, active: boolean): Promise<unknown> {
    const schedule = await this.scheduleForAdmin(actor, id);
    schedule.active = active;
    await this.schedules.save(schedule);
    await this.audit(actor, 'training.schedule.updated', 'training_schedule', id, {
      name: schedule.name,
      active,
    });
    return this.scheduleDetail(actor, id);
  }
  async deleteSchedule(actor: AuthenticatedUser, id: string): Promise<void> {
    const schedule = await this.scheduleForAdmin(actor, id);
    await this.schedules.softRemove(schedule);
    await this.audit(actor, 'training.schedule.deleted', 'training_schedule', id, {
      name: schedule.name,
    });
  }

  async listMySessions(
    actor: AuthenticatedUser,
    from?: string,
    until?: string,
  ): Promise<SessionView[]> {
    const range = this.range(from, until);
    await this.materialize(actor.organizationId, range.from, range.until);
    const rows: SessionRow[] = await this.dataSource.query(
      `SELECT DISTINCT ts.id, ts."trainingScheduleId" AS "scheduleId", s.name, ts."startsAt", ts."endsAt", ts.cancelled,
        a.status, a."respondedAt", a."updatedAt",
        (SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'color',g.color) ORDER BY g.name)
         FROM training_groups atg JOIN groups g ON g.id=atg."groupId" AND g."deletedAt" IS NULL WHERE atg."trainingScheduleId"=s.id) groups
       FROM training_sessions ts JOIN training_schedules s ON s.id=ts."trainingScheduleId" AND s.active=true AND s."deletedAt" IS NULL
       JOIN training_groups tg ON tg."trainingScheduleId"=s.id
       JOIN groups permitted_group ON permitted_group.id=tg."groupId" AND permitted_group.active=true AND permitted_group."deletedAt" IS NULL
       JOIN user_groups ug ON ug."groupId"=permitted_group.id AND ug."userId"=$2
       LEFT JOIN attendances a ON a."trainingSessionId"=ts.id AND a."userId"=$2 AND a."deletedAt" IS NULL
       WHERE ts."organizationId"=$1 AND ts."deletedAt" IS NULL AND ts."startsAt">=$3 AND ts."startsAt"<$4 ORDER BY ts."startsAt"`,
      [actor.organizationId, actor.id, range.from, range.until],
    );
    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      scheduleId: r.scheduleId,
      name: r.name,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      cancelled: r.cancelled,
      locked: new Date(r.startsAt) <= now,
      groups: r.groups ?? [],
      attendance:
        r.status && r.respondedAt && r.updatedAt
          ? { status: r.status, respondedAt: r.respondedAt, updatedAt: r.updatedAt }
          : null,
    }));
  }

  async vote(
    actor: AuthenticatedUser,
    sessionId: string,
    status: AttendanceStatus,
  ): Promise<unknown> {
    return this.dataSource.transaction(async (manager) => {
      const rows: Array<{ id: string; startsAt: Date; cancelled: boolean }> = await manager.query(
        `SELECT DISTINCT ts.id,ts."startsAt",ts.cancelled FROM training_sessions ts
         JOIN training_schedules s ON s.id=ts."trainingScheduleId" AND s.active=true AND s."deletedAt" IS NULL
         JOIN training_groups tg ON tg."trainingScheduleId"=s.id
         JOIN groups g ON g.id=tg."groupId" AND g.active=true AND g."deletedAt" IS NULL
         JOIN user_groups ug ON ug."groupId"=g.id AND ug."userId"=$2
         WHERE ts.id=$1 AND ts."organizationId"=$3 AND ts."deletedAt" IS NULL`,
        [sessionId, actor.id, actor.organizationId],
      );
      const session = rows[0];
      if (!session)
        throw new ForbiddenException('Dieses Training ist deiner Gruppe nicht zugeordnet.');
      if (session.cancelled) throw new ConflictException('Das Training wurde abgesagt.');
      if (new Date(session.startsAt) <= new Date())
        throw new ConflictException('Die Abstimmung ist seit Trainingsbeginn gesperrt.');
      const repo = manager.getRepository(Attendance);
      let attendance = await repo.findOne({
        where: { userId: actor.id, trainingSessionId: sessionId },
      });
      const now = new Date();
      attendance ??= repo.create({
        userId: actor.id,
        trainingSessionId: sessionId,
        respondedAt: now,
      });
      attendance.status = status;
      attendance.respondedAt = attendance.createdAt ? attendance.respondedAt : now;
      return repo.save(attendance);
    });
  }

  async attendanceList(actor: AuthenticatedUser, sessionId: string): Promise<unknown> {
    const session = await this.dataSource
      .getRepository(TrainingSession)
      .findOne({ where: { id: sessionId, organizationId: actor.organizationId } });
    if (!session) throw new NotFoundException('Trainingstermin wurde nicht gefunden.');
    const items: AttendanceRow[] = await this.dataSource.query(
      `SELECT DISTINCT u.id,u."firstName",u."lastName",a.status,a."updatedAt"
       FROM users u JOIN user_groups ug ON ug."userId"=u.id
       JOIN training_groups tg ON tg."groupId"=ug."groupId" AND tg."trainingScheduleId"=$2
       LEFT JOIN attendances a ON a."userId"=u.id AND a."trainingSessionId"=$1 AND a."deletedAt" IS NULL
       WHERE u."organizationId"=$3 AND u.status='approved' AND u."deletedAt" IS NULL ORDER BY u."lastName",u."firstName"`,
      [sessionId, session.trainingScheduleId, actor.organizationId],
    );
    const yes = items.filter((i) => i.status === AttendanceStatus.Yes).length,
      no = items.filter((i) => i.status === AttendanceStatus.No).length;
    return { sessionId, total: items.length, yes, no, unanswered: items.length - yes - no, items };
  }

  async listAdminSessions(
    actor: AuthenticatedUser,
    from?: string,
    until?: string,
  ): Promise<SessionView[]> {
    const range = this.range(from, until);
    await this.materialize(actor.organizationId, range.from, range.until);
    const rows: SessionRow[] = await this.dataSource.query(
      `SELECT ts.id, ts."trainingScheduleId" AS "scheduleId", s.name, ts."startsAt", ts."endsAt", ts.cancelled,
        NULL::text AS status, NULL::timestamptz AS "respondedAt", NULL::timestamptz AS "updatedAt",
        (SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'color',g.color) ORDER BY g.name)
         FROM training_groups tg JOIN groups g ON g.id=tg."groupId" AND g."deletedAt" IS NULL
         WHERE tg."trainingScheduleId"=s.id) groups
       FROM training_sessions ts JOIN training_schedules s ON s.id=ts."trainingScheduleId"
       WHERE ts."organizationId"=$1 AND ts."deletedAt" IS NULL AND ts."startsAt">=$2 AND ts."startsAt"<$3
       ORDER BY ts."startsAt"`,
      [actor.organizationId, range.from, range.until],
    );
    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      scheduleId: r.scheduleId,
      name: r.name,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      cancelled: r.cancelled,
      locked: new Date(r.startsAt) <= now,
      groups: r.groups ?? [],
      attendance: null,
    }));
  }

  async createSession(actor: AuthenticatedUser, dto: CreateSessionDto): Promise<TrainingSession> {
    const schedule = await this.scheduleForAdmin(actor, dto.trainingScheduleId);
    const startsAt = new Date(dto.startsAt),
      endsAt = new Date(dto.endsAt);
    this.validateSessionTimes(startsAt, endsAt);
    try {
      const session = await this.dataSource.getRepository(TrainingSession).save({
        organizationId: actor.organizationId,
        trainingScheduleId: schedule.id,
        startsAt,
        endsAt,
        cancelled: dto.cancelled ?? false,
      });
      await this.audit(actor, 'training.session.created', 'training_session', session.id, {
        scheduleId: schedule.id,
        startsAt: session.startsAt,
      });
      return session;
    } catch (error) {
      this.rethrowUnique(
        error,
        'Für diese Trainingszeit existiert zu diesem Zeitpunkt bereits ein Termin.',
      );
    }
  }

  async updateSession(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateSessionDto,
  ): Promise<TrainingSession> {
    const session = await this.sessionForAdmin(actor, id);
    const startsAt = new Date(dto.startsAt),
      endsAt = new Date(dto.endsAt);
    this.validateSessionTimes(startsAt, endsAt);
    session.startsAt = startsAt;
    session.endsAt = endsAt;
    session.cancelled = dto.cancelled;
    try {
      const saved = await this.dataSource.getRepository(TrainingSession).save(session);
      await this.audit(actor, 'training.session.updated', 'training_session', saved.id, {
        startsAt: saved.startsAt,
      });
      return saved;
    } catch (error) {
      this.rethrowUnique(
        error,
        'Für diese Trainingszeit existiert zu diesem Zeitpunkt bereits ein Termin.',
      );
    }
  }

  async setSessionCancelled(
    actor: AuthenticatedUser,
    id: string,
    cancelled: boolean,
  ): Promise<TrainingSession> {
    const session = await this.sessionForAdmin(actor, id);
    session.cancelled = cancelled;
    const saved = await this.dataSource.getRepository(TrainingSession).save(session);
    await this.audit(actor, 'training.session.updated', 'training_session', saved.id, {
      cancelled,
    });
    return saved;
  }

  async deleteSession(actor: AuthenticatedUser, id: string): Promise<void> {
    const session = await this.sessionForAdmin(actor, id);
    await this.dataSource.getRepository(TrainingSession).softRemove(session);
    await this.audit(actor, 'training.session.deleted', 'training_session', id, {
      startsAt: session.startsAt,
    });
  }

  private async saveSchedule(
    actor: AuthenticatedUser,
    id: string | null,
    dto: CreateScheduleDto,
  ): Promise<unknown> {
    if (dto.endTime <= dto.startTime)
      throw new BadRequestException('Die Endzeit muss nach der Startzeit liegen.');
    if (dto.validFrom && dto.validUntil && dto.validUntil < dto.validFrom)
      throw new BadRequestException('Das Enddatum liegt vor dem Startdatum.');
    return this.dataSource.transaction(async (manager) => {
      const uniqueIds = [...new Set(dto.groupIds)];
      const groups = uniqueIds.length
        ? await manager
            .getRepository(Group)
            .find({ where: { id: In(uniqueIds), organizationId: actor.organizationId } })
        : [];
      if (!groups.length || groups.length !== uniqueIds.length)
        throw new NotFoundException('Mindestens eine Gruppe wurde nicht gefunden.');
      let schedule = id
        ? await manager
            .getRepository(TrainingSchedule)
            .findOne({ where: { id, organizationId: actor.organizationId } })
        : null;
      if (id && !schedule) throw new NotFoundException('Trainingszeit wurde nicht gefunden.');
      schedule ??= manager
        .getRepository(TrainingSchedule)
        .create({ organizationId: actor.organizationId });
      Object.assign(schedule, {
        name: dto.name.trim(),
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        validFrom: dto.validFrom ?? null,
        validUntil: dto.validUntil ?? null,
        active: dto.active ?? true,
      });
      schedule = await manager.getRepository(TrainingSchedule).save(schedule);
      await manager.getRepository(TrainingGroup).delete({ trainingScheduleId: schedule.id });
      await manager
        .getRepository(TrainingGroup)
        .insert(groups.map((g) => ({ trainingScheduleId: schedule.id, groupId: g.id })));
      if (id) {
        await manager
          .getRepository(TrainingSession)
          .createQueryBuilder()
          .delete()
          .where('"trainingScheduleId" = :id AND "startsAt" > now()', { id: schedule.id })
          .execute();
      }
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: id ? 'training.schedule.updated' : 'training.schedule.created',
        entityType: 'training_schedule',
        entityId: schedule.id,
        outcome: 'success',
        metadata: { name: schedule.name, groupIds: uniqueIds },
      });
      return { ...schedule, groups: groups.map(({ id, name }) => ({ id, name })) };
    });
  }

  private async materialize(organizationId: string, from: Date, until: Date): Promise<void> {
    const org = await this.dataSource
      .getRepository(Organization)
      .findOneByOrFail({ id: organizationId });
    const schedules = await this.schedules.find({ where: { organizationId, active: true } });
    const rows: Array<Partial<TrainingSession>> = [];
    for (const s of schedules) {
      for (
        let cursor = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
        );
        cursor < until;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      ) {
        const iso = cursor.toISOString().slice(0, 10);
        const weekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
        if (
          weekday !== s.weekday ||
          (s.validFrom && iso < s.validFrom) ||
          (s.validUntil && iso > s.validUntil)
        )
          continue;
        const startsAt = zonedDate(iso, s.startTime, org.timezone),
          endsAt = zonedDate(iso, s.endTime, org.timezone);
        rows.push({ organizationId, trainingScheduleId: s.id, startsAt, endsAt, cancelled: false });
      }
    }
    if (rows.length)
      await this.dataSource.getRepository(TrainingSession).upsert(rows, {
        conflictPaths: ['trainingScheduleId', 'startsAt'],
        skipUpdateIfNoValuesChanged: true,
      });
  }
  private range(from?: string, until?: string) {
    const now = new Date();
    const start = from ? new Date(`${from}T00:00:00Z`) : now;
    const end = until ? new Date(`${until}T00:00:00Z`) : new Date(now.getTime() + 90 * 86400000);
    if (isNaN(start.valueOf()) || isNaN(end.valueOf()) || end <= start)
      throw new BadRequestException('Ungültiger Zeitraum.');
    if (end.getTime() - start.getTime() > 366 * 86400000)
      throw new BadRequestException('Der Zeitraum ist zu groß.');
    return { from: start, until: end };
  }
  private async scheduleDetail(actor: AuthenticatedUser, id: string) {
    const all = await this.listSchedules(actor);
    const found = all.find((s) => s.id === id);
    if (!found) throw new NotFoundException();
    return found;
  }
  private async groupForAdmin(actor: AuthenticatedUser, id: string) {
    const g = await this.groups.findOne({ where: { id, organizationId: actor.organizationId } });
    if (!g) throw new NotFoundException('Gruppe wurde nicht gefunden.');
    return g;
  }
  private async scheduleForAdmin(actor: AuthenticatedUser, id: string) {
    const s = await this.schedules.findOne({ where: { id, organizationId: actor.organizationId } });
    if (!s) throw new NotFoundException('Trainingszeit wurde nicht gefunden.');
    return s;
  }
  private validateAges(min?: number, max?: number) {
    if (min !== undefined && max !== undefined && max < min)
      throw new BadRequestException('Das Höchstalter darf nicht unter dem Mindestalter liegen.');
  }
  private validateSessionTimes(startsAt: Date, endsAt: Date) {
    if (isNaN(startsAt.valueOf()) || isNaN(endsAt.valueOf()) || endsAt <= startsAt)
      throw new BadRequestException('Die Endzeit muss nach der Startzeit liegen.');
  }
  private async sessionForAdmin(actor: AuthenticatedUser, id: string) {
    const session = await this.dataSource.getRepository(TrainingSession).findOne({
      where: { id, organizationId: actor.organizationId },
    });
    if (!session) throw new NotFoundException('Trainingstermin wurde nicht gefunden.');
    return session;
  }
  private audit(
    actor: AuthenticatedUser,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.dataSource.getRepository(AuditLog).save({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action,
      entityType,
      entityId,
      outcome: 'success',
      metadata,
    });
  }
  private rethrowUnique(error: unknown, message: string): never {
    if ((error as { code?: string }).code === '23505') throw new ConflictException(message);
    throw error;
  }
}

function zonedDate(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number),
    [hh, mm, ss = 0] = time.split(':').map(Number);
  const utcGuess = Date.UTC(y!, m! - 1, d, hh, mm, ss);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcGuess));
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const represented = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return new Date(utcGuess - (represented - utcGuess));
}
