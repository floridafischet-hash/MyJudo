import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';

export enum ProjectStatus {
  Active = 'active',
  Completed = 'completed',
  Archived = 'archived',
}
@Entity('projects')
export class Project extends BaseEntity {
  @Column('uuid') organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
  @Column('uuid') createdBy!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'varchar', length: 1000, nullable: true }) description!: string | null;
  @Column({
    type: 'enum',
    enum: ProjectStatus,
    enumName: 'projects_status_enum',
    default: ProjectStatus.Active,
  })
  status!: ProjectStatus;
  @Column({ type: 'date', nullable: true }) startDate!: string | null;
  @Column({ type: 'date', nullable: true }) targetDate!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) category!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}
