import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export enum CalendarMeetingProvider {
  GoogleMeet = 'google_meet',
  MicrosoftTeams = 'microsoft_teams',
  Other = 'other',
}

@Entity('calendar_events')
@Index(['organizationId', 'startsAt'])
@Index(['seriesId', 'startsAt'])
export class CalendarEvent extends BaseEntity {
  @Column({ type: 'uuid' }) organizationId!: string;
  @Column({ type: 'uuid' }) createdBy!: string;
  @Column({ type: 'uuid', nullable: true }) seriesId!: string | null;
  @Column({ type: 'varchar', length: 180 }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'timestamptz' }) startsAt!: Date;
  @Column({ type: 'timestamptz' }) endsAt!: Date;
  @Column({ type: 'varchar', length: 180, nullable: true }) location!: string | null;
  @Column({ type: 'varchar', length: 50, default: 'event' }) eventType!: string;
  @Column({ type: 'uuid', array: true, default: '{}' }) groupIds!: string[];
  @Column({ type: 'uuid', array: true, default: '{}' }) participantIds!: string[];
  @Column({ type: 'integer', nullable: true }) reminderMinutes!: number | null;
  @Column({ type: 'varchar', length: 20, default: 'none' }) recurrence!: string;
  @Column({ type: 'integer', default: 1 }) recurrenceInterval!: number;
  @Column({ type: 'date', nullable: true }) recurrenceUntil!: string | null;
  @Column({ type: 'integer', nullable: true }) recurrenceCount!: number | null;
  @Column({
    type: 'enum',
    enum: CalendarMeetingProvider,
    enumName: 'calendar_meeting_provider_enum',
    nullable: true,
  })
  meetingProvider!: CalendarMeetingProvider | null;
  @Column({ type: 'varchar', length: 2048, nullable: true }) meetingUrl!: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) meetingNotes!: string | null;
}
