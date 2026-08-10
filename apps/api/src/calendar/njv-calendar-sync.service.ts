import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import ICALTypes from 'ical.js';
import { createRequire } from 'node:module';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { CalendarEvent, CalendarEventSource, CalendarEventStatus } from './calendar-event.entity';
import { ClubCalendar } from './calendar.entity';

const loadedIcal: unknown = createRequire(__filename)('ical.js');
if (!isIcalModule(loadedIcal)) throw new Error('ical.js runtime is invalid');
const ICAL = loadedIcal;

export interface CalendarSyncResult {
  calendars: number;
  imported: number;
  cancelled: number;
}

@Injectable()
export class NjvCalendarSyncService {
  private readonly logger = new Logger(NjvCalendarSyncService.name);

  constructor(
    @InjectRepository(ClubCalendar) private readonly calendars: Repository<ClubCalendar>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 20 3 * * *', { timeZone: 'Europe/Berlin' })
  async scheduledSync(): Promise<void> {
    if (this.config.get<string>('EXTERNAL_CALENDAR_SYNC_ENABLED') !== 'true') return;
    try {
      await this.sync();
    } catch (error) {
      this.logger.error(
        'NJV calendar synchronization failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async sync(
    organizationId?: string,
    actorUserId: string | null = null,
  ): Promise<CalendarSyncResult> {
    const sourceUrl = this.config.getOrThrow<string>('NJV_ICS_URL');
    const items = await this.fetchEvents(sourceUrl);
    if (!items.length) {
      throw new ServiceUnavailableException('Der NJV-Kalender enthält keine Termine.');
    }
    const calendars = await this.calendars.findBy({
      systemKey: 'njv',
      ...(organizationId ? { organizationId } : {}),
    });
    let imported = 0;
    let cancelled = 0;
    for (const calendar of calendars) {
      const result = await this.syncCalendar(calendar, sourceUrl, items, actorUserId);
      imported += result.imported;
      cancelled += result.cancelled;
    }
    return { calendars: calendars.length, imported, cancelled };
  }

  private async fetchEvents(sourceUrl: string): Promise<ExternalEvent[]> {
    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        headers: { accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.1' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ServiceUnavailableException('Der NJV-Kalender ist derzeit nicht erreichbar.');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Der NJV-Kalender antwortete mit HTTP ${response.status}.`,
      );
    }
    const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '0', 10);
    if (declaredLength > 5_000_000)
      throw new ServiceUnavailableException('Der NJV-Kalender ist zu groß.');
    const body = await response.text();
    if (body.length > 5_000_000 || !body.trimStart().startsWith('BEGIN:VCALENDAR')) {
      throw new ServiceUnavailableException('Der NJV-Kalender enthält kein gültiges ICS-Dokument.');
    }
    try {
      return parseNjvIcs(body);
    } catch {
      throw new ServiceUnavailableException('Der NJV-Kalender konnte nicht verarbeitet werden.');
    }
  }

  private syncCalendar(
    calendar: ClubCalendar,
    feedUrl: string,
    items: ExternalEvent[],
    actorUserId: string | null,
  ): Promise<{ imported: number; cancelled: number }> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CalendarEvent);
      for (const item of items) {
        await repository.upsert(
          {
            organizationId: calendar.organizationId,
            calendarId: calendar.id,
            title: item.title,
            description: item.description,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            allDay: item.allDay,
            location: item.location,
            status: CalendarEventStatus.Scheduled,
            source: CalendarEventSource.Njv,
            sourceExternalId: item.uid,
            sourceUrl: item.sourceUrl ?? feedUrl,
            createdBy: calendar.createdBy,
          },
          {
            conflictPaths: ['calendarId', 'source', 'sourceExternalId'],
            indexPredicate: '"sourceExternalId" IS NOT NULL AND "deletedAt" IS NULL',
          },
        );
      }
      const identifiers = items.map((item) => item.uid);
      const missing = await repository.find({
        where: {
          calendarId: calendar.id,
          source: CalendarEventSource.Njv,
          status: CalendarEventStatus.Scheduled,
          startsAt: MoreThanOrEqual(new Date()),
        },
      });
      const identifierSet = new Set(identifiers);
      const stale = missing.filter(
        (event) => !event.sourceExternalId || !identifierSet.has(event.sourceExternalId),
      );
      if (stale.length) {
        await repository.update(
          { id: In(stale.map((event) => event.id)) },
          { status: CalendarEventStatus.Cancelled },
        );
      }
      await manager.getRepository(AuditLog).save({
        organizationId: calendar.organizationId,
        actorUserId,
        action: 'calendar.njv.synchronized',
        entityType: 'calendar',
        entityId: calendar.id,
        outcome: 'success',
        metadata: { imported: items.length, cancelled: stale.length },
      });
      return { imported: items.length, cancelled: stale.length };
    });
  }
}

export interface ExternalEvent {
  uid: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  location: string | null;
  sourceUrl: string | null;
}

export function parseNjvIcs(body: string): ExternalEvent[] {
  const parsed: unknown = ICAL.parse(body);
  if (!Array.isArray(parsed)) throw new Error('Invalid jCal');
  const root = new ICAL.Component(parsed);
  return root.getAllSubcomponents('vevent').map((component) => {
    const event = new ICAL.Event(component);
    const startsAt = event.startDate.toJSDate();
    const endsAt = event.endDate?.toJSDate() ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
    if (!event.uid || !event.summary || endsAt <= startsAt) throw new Error('Invalid event');
    return {
      uid: limited(event.uid, 255),
      title: limited(event.summary.trim(), 200),
      description: nullableLimited(event.description, 8000),
      startsAt,
      endsAt,
      allDay: event.startDate.isDate,
      location: nullableLimited(event.location, 240),
      sourceUrl: safeHttpsUrl(component.getFirstPropertyValue('url')),
    };
  });
}

function limited(value: string, maximum: number): string {
  if (!value.trim()) throw new Error('Required ICS value is empty');
  return value.slice(0, maximum);
}

function nullableLimited(value: string | undefined | null, maximum: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maximum) : null;
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString().slice(0, 1000) : null;
  } catch {
    return null;
  }
}

function isIcalModule(value: unknown): value is typeof ICALTypes {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { parse?: unknown; Component?: unknown; Event?: unknown };
  return (
    typeof candidate.parse === 'function' &&
    typeof candidate.Component === 'function' &&
    typeof candidate.Event === 'function'
  );
}
