import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../users/user.entity';
import { TrainingSession } from './training-session.entity';

export enum AttendanceStatus {
  Yes = 'yes',
  No = 'no',
}

@Entity('attendances')
@Index(['userId', 'trainingSessionId'], { unique: true, where: '"deletedAt" IS NULL' })
export class Attendance extends BaseEntity {
  @Column('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column('uuid') trainingSessionId!: string;
  @ManyToOne(() => TrainingSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainingSessionId' })
  session!: TrainingSession;
  @Column({ type: 'enum', enum: AttendanceStatus }) status!: AttendanceStatus;
  @Column({ type: 'timestamptz' }) respondedAt!: Date;
}
