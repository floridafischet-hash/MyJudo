import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { PERMISSIONS } from '../rbac/permission.catalog';
import { PermissionService } from '../rbac/permission.service';
import { CalendarEvent, CalendarEventSource, CalendarEventStatus } from './calendar-event.entity';
import { CalendarType, ClubCalendar } from './calendar.entity';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { ListCalendarEventsDto } from './dto/list-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { UpdateTrainingSessionDto } from './dto/update-training-session.dto';
import { TrainingSession } from './training-session.entity';

export interface CalendarSummary {
  id: string;
  name: string;
  type: CalendarType;
  requiredPermission: string | null;
  editable: boolean;
}

export interface CalendarEventSummary {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  location: string | null;
  status: CalendarEventStatus;
  source: CalendarEventSource;
  sourceUrl: string | null;
}

export interface TrainingSessionSummary {
  id: string;
  name: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  hall: string;
  location: string;
  ageGroup: string | null;
  trainingGroup: string | null;
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(ClubCalendar) private readonly calendars: Repository<ClubCalendar>,
    @InjectRepository(CalendarEvent) private readonly events: Repository<CalendarEvent>,
    @InjectRepository(TrainingSession) private readonly trainings: Repository<TrainingSession>,
    private readonly dataSource: DataSource,
    private readonly permissions: PermissionService,
  ) {}

  async listCalendars(actor: AuthenticatedUser): Promise<CalendarSummary[]> {
    const permissionSet = await this.permissionSet(actor);
    const rows = await this.calendars.find({
      where: { organizationId: actor.organizationId },
      order: { name: 'ASC' },
    });
    return rows
      .filter((calendar) => this.isAccessible(actor, calendar, permissionSet))
      .map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        type: calendar.type,
        requiredPermission: calendar.requiredPermission,
        editable:
          calendar.type !== CalendarType.Association &&
          (calendar.ownerUserId === actor.id || permissionSet.has('calendar.create')),
      }));
  }

  async createCalendar(actor: AuthenticatedUser, dto: CreateCalendarDto): Promise<CalendarSummary> {
    if (dto.type === CalendarType.Association) {
      throw new BadRequestException('Verbandskalender werden ausschließlich synchronisiert.');
    }
    const permissionSet = await this.permissionSet(actor);
    this.assertTargetPermission(dto.requiredPermission, permissionSet);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Der Kalendername darf nicht leer sein.');
    const calendar = await this.calendars.save({
      organizationId: actor.organizationId,
      type: dto.type,
      name,
      ownerUserId: dto.type === CalendarType.Private ? actor.id : null,
      requiredPermission:
        dto.type === CalendarType.Private ? null : (dto.requiredPermission ?? null),
      systemKey: null,
      createdBy: actor.id,
    });
    return {
      id: calendar.id,
      name: calendar.name,
      type: calendar.type,
      requiredPermission: calendar.requiredPermission,
      editable: true,
    };
  }

  async listEvents(
    actor: AuthenticatedUser,
    query: ListCalendarEventsDto,
  ): Promise<CalendarEventSummary[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'Der Kalenderzeitraum muss zwischen einem Tag und 366 Tagen liegen.',
      );
    }
    const calendars = await this.visibleCalendars(actor);
    if (!calendars.length) return [];
    const events = await this.events.find({
      where: {
        organizationId: actor.organizationId,
        calendarId: In(calendars.map((calendar) => calendar.id)),
        startsAt: LessThan(to),
        endsAt: MoreThan(from),
      },
      relations: { calendar: true },
      order: { startsAt: 'ASC' },
    });
    return events.map((event) => this.eventSummary(event));
  }

  async createEvent(
    actor: AuthenticatedUser,
    calendarId: string,
    dto: CreateCalendarEventDto,
  ): Promise<CalendarEventSummary> {
    const calendar = await this.editableCalendar(actor, calendarId);
    const times = this.eventTimes(dto.startsAt, dto.endsAt);
    const event = await this.events.save({
      organizationId: actor.organizationId,
      calendarId: calendar.id,
      title: this.requiredTrimmed(dto.title, 'Der Termintitel darf nicht leer sein.'),
      description: dto.description?.trim() || null,
      ...times,
      allDay: dto.allDay,
      location: dto.location?.trim() || null,
      status: dto.status ?? CalendarEventStatus.Scheduled,
      source: CalendarEventSource.Club,
      sourceExternalId: null,
      sourceUrl: null,
      createdBy: actor.id,
    });
    await this.audit(actor, 'calendar.event.created', event.id, { calendarId });
    event.calendar = calendar;
    return this.eventSummary(event);
  }

  async updateEvent(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventSummary> {
    const event = await this.events.findOne({
      where: { id, organizationId: actor.organizationId },
      relations: { calendar: true },
    });
    if (!event) throw new NotFoundException('Termin wurde nicht gefunden.');
    await this.assertCalendarEditable(actor, event.calendar);
    if (event.source !== CalendarEventSource.Club) {
      throw new ForbiddenException('Synchronisierte Verbandstermine sind schreibgeschützt.');
    }
    if (dto.title !== undefined) {
      event.title = this.requiredTrimmed(dto.title, 'Der Termintitel darf nicht leer sein.');
    }
    if (dto.description !== undefined) event.description = dto.description.trim() || null;
    if (dto.location !== undefined) event.location = dto.location.trim() || null;
    if (dto.allDay !== undefined) event.allDay = dto.allDay;
    if (dto.status !== undefined) event.status = dto.status;
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : event.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : event.endsAt;
    Object.assign(event, this.eventTimes(startsAt.toISOString(), endsAt.toISOString()));
    await this.events.save(event);
    await this.audit(actor, 'calendar.event.updated', event.id, { calendarId: event.calendarId });
    return this.eventSummary(event);
  }

  async listTrainings(actor: AuthenticatedUser): Promise<TrainingSessionSummary[]> {
    const permissionSet = await this.permissionSet(actor);
    const rows = await this.trainings.find({
      where: { organizationId: actor.organizationId },
      order: { weekday: 'ASC', startsAt: 'ASC' },
    });
    return rows
      .filter(
        (training) =>
          !training.requiredPermission || permissionSet.has(training.requiredPermission),
      )
      .map((training) => this.trainingSummary(training));
  }

  async createTraining(
    actor: AuthenticatedUser,
    dto: CreateTrainingSessionDto,
  ): Promise<TrainingSessionSummary> {
    const permissionSet = await this.permissionSet(actor);
    this.assertTargetPermission(dto.requiredPermission, permissionSet);
    this.assertTrainingTimes(dto.startsAt, dto.endsAt);
    const training = await this.trainings.save({
      organizationId: actor.organizationId,
      ...this.trainingValues(dto),
      createdBy: actor.id,
    });
    await this.audit(actor, 'training.created', training.id, null);
    return this.trainingSummary(training);
  }

  async updateTraining(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateTrainingSessionDto,
  ): Promise<TrainingSessionSummary> {
    const training = await this.trainings.findOneBy({ id, organizationId: actor.organizationId });
    if (!training) throw new NotFoundException('Trainingszeit wurde nicht gefunden.');
    const permissionSet = await this.permissionSet(actor);
    if (dto.requiredPermission !== undefined) {
      this.assertTargetPermission(dto.requiredPermission, permissionSet);
      training.requiredPermission = dto.requiredPermission || null;
    }
    const startsAt = dto.startsAt ?? training.startsAt.slice(0, 5);
    const endsAt = dto.endsAt ?? training.endsAt.slice(0, 5);
    this.assertTrainingTimes(startsAt, endsAt);
    Object.assign(training, this.trainingValues(dto));
    training.startsAt = startsAt;
    training.endsAt = endsAt;
    await this.trainings.save(training);
    await this.audit(actor, 'training.updated', training.id, null);
    return this.trainingSummary(training);
  }

  private trainingValues(dto: CreateTrainingSessionDto | UpdateTrainingSessionDto) {
    return Object.fromEntries(
      Object.entries({
        name: dto.name?.trim(),
        weekday: dto.weekday,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        hall: dto.hall?.trim(),
        location: dto.location?.trim(),
        ageGroup: dto.ageGroup?.trim() || null,
        trainingGroup: dto.trainingGroup?.trim() || null,
        requiredPermission: dto.requiredPermission || null,
      }).filter(([, value]) => value !== undefined),
    );
  }

  private async visibleCalendars(actor: AuthenticatedUser): Promise<ClubCalendar[]> {
    const permissionSet = await this.permissionSet(actor);
    const calendars = await this.calendars.findBy({ organizationId: actor.organizationId });
    return calendars.filter((calendar) => this.isAccessible(actor, calendar, permissionSet));
  }

  private isAccessible(
    actor: AuthenticatedUser,
    calendar: ClubCalendar,
    permissionSet: Set<string>,
  ): boolean {
    if (calendar.ownerUserId) return calendar.ownerUserId === actor.id;
    return !calendar.requiredPermission || permissionSet.has(calendar.requiredPermission);
  }

  private async editableCalendar(actor: AuthenticatedUser, id: string): Promise<ClubCalendar> {
    const calendar = await this.calendars.findOneBy({ id, organizationId: actor.organizationId });
    if (!calendar) throw new NotFoundException('Kalender wurde nicht gefunden.');
    await this.assertCalendarEditable(actor, calendar);
    return calendar;
  }

  private async assertCalendarEditable(
    actor: AuthenticatedUser,
    calendar: ClubCalendar,
  ): Promise<void> {
    const permissionSet = await this.permissionSet(actor);
    if (!this.isAccessible(actor, calendar, permissionSet)) {
      throw new NotFoundException('Kalender wurde nicht gefunden.');
    }
    if (calendar.type === CalendarType.Association) {
      throw new ForbiddenException('Dieser Kalender ist schreibgeschützt.');
    }
  }

  private eventSummary(event: CalendarEvent): CalendarEventSummary {
    return {
      id: event.id,
      calendarId: event.calendarId,
      calendarName: event.calendar.name,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      location: event.location,
      status: event.status,
      source: event.source,
      sourceUrl: event.sourceUrl,
    };
  }

  private trainingSummary(training: TrainingSession): TrainingSessionSummary {
    return {
      id: training.id,
      name: training.name,
      weekday: training.weekday,
      startsAt: training.startsAt,
      endsAt: training.endsAt,
      hall: training.hall,
      location: training.location,
      ageGroup: training.ageGroup,
      trainingGroup: training.trainingGroup,
    };
  }

  private assertTargetPermission(
    requiredPermission: string | undefined,
    permissionSet: Set<string>,
  ): void {
    if (!requiredPermission) return;
    if (!(PERMISSIONS as readonly string[]).includes(requiredPermission)) {
      throw new BadRequestException('Die Zielgruppen-Berechtigung ist ungültig.');
    }
    if (!permissionSet.has(requiredPermission)) {
      throw new ForbiddenException('Du darfst diese Zielgruppe nicht auswählen.');
    }
  }

  private eventTimes(startsAtValue: string, endsAtValue: string) {
    const startsAt = new Date(startsAtValue);
    const endsAt = new Date(endsAtValue);
    if (endsAt <= startsAt)
      throw new BadRequestException('Das Terminende muss nach dem Beginn liegen.');
    return { startsAt, endsAt };
  }

  private assertTrainingTimes(startsAt: string, endsAt: string): void {
    if (endsAt <= startsAt) {
      throw new BadRequestException('Das Trainingsende muss nach dem Beginn liegen.');
    }
  }

  private requiredTrimmed(value: string, message: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(message);
    return trimmed;
  }

  private async permissionSet(actor: AuthenticatedUser): Promise<Set<string>> {
    return new Set(await this.permissions.listForUser(actor.id, actor.organizationId));
  }

  private async audit(
    actor: AuthenticatedUser,
    action: string,
    entityId: string,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    await this.dataSource.getRepository(AuditLog).save({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action,
      entityType: action.startsWith('training.') ? 'training_session' : 'calendar_event',
      entityId,
      outcome: 'success',
      metadata,
    });
  }
}
