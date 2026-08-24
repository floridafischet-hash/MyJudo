import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';

@Entity('training_schedules')
@Index(['organizationId', 'weekday', 'active'])
export class TrainingSchedule extends BaseEntity {
  @Column('uuid') organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'smallint' }) weekday!: number;
  @Column({ type: 'time without time zone' }) startTime!: string;
  @Column({ type: 'time without time zone' }) endTime!: string;
  @Column({ type: 'date', nullable: true }) validFrom!: string | null;
  @Column({ type: 'date', nullable: true }) validUntil!: string | null;
  @Column({ type: 'boolean', default: true }) active!: boolean;
}
