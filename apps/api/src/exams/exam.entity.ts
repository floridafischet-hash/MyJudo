import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { ExamParticipant } from './exam-participant.entity';

@Entity('exams')
@Index(['organizationId', 'examDate'])
export class Exam extends BaseEntity {
  @Column('uuid') organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
  @Column({ type: 'varchar', length: 180 }) title!: string;
  @Column({ type: 'date' }) examDate!: string;
  @Column({ type: 'varchar', length: 240, nullable: true }) location!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column('uuid') createdBy!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;
  @OneToMany(() => ExamParticipant, (participant) => participant.exam)
  participants!: ExamParticipant[];
}
