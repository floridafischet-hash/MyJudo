import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { TrainingSchedule } from './training-schedule.entity';

@Entity('training_sessions')
@Index(['trainingScheduleId', 'startsAt'], { unique: true })
@Index(['organizationId', 'startsAt'])
export class TrainingSession extends BaseEntity {
  @Column('uuid') organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
  @Column('uuid') trainingScheduleId!: string;
  @ManyToOne(() => TrainingSchedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainingScheduleId' })
  schedule!: TrainingSchedule;
  @Column({ type: 'timestamptz' }) startsAt!: Date;
  @Column({ type: 'timestamptz' }) endsAt!: Date;
  @Column({ type: 'boolean', default: false }) cancelled!: boolean;
}
