import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';

@Entity('training_sessions')
@Index(['organizationId', 'weekday', 'startsAt'])
export class TrainingSession extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'smallint' })
  weekday!: number;

  @Column({ type: 'time' })
  startsAt!: string;

  @Column({ type: 'time' })
  endsAt!: string;

  @Column({ type: 'varchar', length: 160 })
  hall!: string;

  @Column({ type: 'varchar', length: 240 })
  location!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  ageGroup!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  trainingGroup!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  requiredPermission!: string | null;

  @Column({ type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;
}
