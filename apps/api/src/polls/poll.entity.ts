import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { PollOption } from './poll-option.entity';

export enum PollType {
  Attendance = 'attendance',
  Choice = 'choice',
}

@Entity('polls')
@Index(['organizationId', 'endsAt'])
export class Poll extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ type: 'enum', enum: PollType, enumName: 'polls_type_enum' })
  type!: PollType;

  @Column({ type: 'varchar', length: 180 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'timestamptz' })
  endsAt!: Date;

  @Column({ type: 'varchar', length: 120, nullable: true })
  requiredPermission!: string | null;

  @Column({ type: 'boolean', default: false })
  resultsVisibleToParticipants!: boolean;

  @Column({ type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @OneToMany(() => PollOption, (option) => option.poll)
  options!: PollOption[];
}
