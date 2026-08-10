import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';

export enum CalendarType {
  Private = 'private',
  Club = 'club',
  Trainer = 'trainer',
  Youth = 'youth',
  Board = 'board',
  Exams = 'exams',
  Association = 'association',
}

@Entity('calendars')
@Index(['organizationId', 'systemKey'], {
  unique: true,
  where: '"systemKey" IS NOT NULL AND "deletedAt" IS NULL',
})
export class ClubCalendar extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ type: 'enum', enum: CalendarType, enumName: 'calendars_type_enum' })
  type!: CalendarType;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'uuid', nullable: true })
  ownerUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId' })
  owner!: User | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  requiredPermission!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  systemKey!: string | null;

  @Column({ type: 'uuid' })
  createdBy!: string;
}
