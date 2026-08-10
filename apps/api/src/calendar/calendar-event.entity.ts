import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { ClubCalendar } from './calendar.entity';

export enum CalendarEventStatus {
  Scheduled = 'scheduled',
  Cancelled = 'cancelled',
}

export enum CalendarEventSource {
  Club = 'club',
  Njv = 'njv',
  Djb = 'djb',
}

@Entity('calendar_events')
@Index(['organizationId', 'startsAt'])
@Index(['calendarId', 'source', 'sourceExternalId'], {
  unique: true,
  where: '"sourceExternalId" IS NOT NULL AND "deletedAt" IS NULL',
})
export class CalendarEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ type: 'uuid' })
  calendarId!: string;

  @ManyToOne(() => ClubCalendar, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calendarId' })
  calendar!: ClubCalendar;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'timestamptz' })
  endsAt!: Date;

  @Column({ type: 'boolean', default: false })
  allDay!: boolean;

  @Column({ type: 'varchar', length: 240, nullable: true })
  location!: string | null;

  @Column({ type: 'enum', enum: CalendarEventStatus, enumName: 'calendar_events_status_enum' })
  status!: CalendarEventStatus;

  @Column({ type: 'enum', enum: CalendarEventSource, enumName: 'calendar_events_source_enum' })
  source!: CalendarEventSource;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceExternalId!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;
}
