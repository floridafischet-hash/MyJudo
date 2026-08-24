import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Group } from './group.entity';
import { TrainingSchedule } from './training-schedule.entity';

@Entity('training_groups')
export class TrainingGroup {
  @PrimaryColumn('uuid') trainingScheduleId!: string;
  @PrimaryColumn('uuid') groupId!: string;
  @ManyToOne(() => TrainingSchedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainingScheduleId' })
  schedule!: TrainingSchedule;
  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group!: Group;
}
