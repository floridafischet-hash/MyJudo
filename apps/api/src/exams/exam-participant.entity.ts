import { Check, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Member } from '../members/member.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { Exam } from './exam.entity';

export enum GradeType {
  Kyu = 'kyu',
  Dan = 'dan',
}

export enum ExamParticipantStatus {
  Planned = 'planned',
  Registered = 'registered',
  Passed = 'passed',
  Failed = 'failed',
  Withdrawn = 'withdrawn',
}

@Entity('exam_participants')
@Unique('UQ_exam_participant_member', ['examId', 'memberId'])
@Index(['organizationId', 'status'])
@Check(
  'CK_exam_grade',
  `("gradeType" = 'kyu' AND "grade" BETWEEN 1 AND 8) OR ("gradeType" = 'dan' AND "grade" BETWEEN 1 AND 10)`,
)
export class ExamParticipant extends BaseEntity {
  @Column('uuid') organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
  @Column('uuid') examId!: string;
  @ManyToOne(() => Exam, (exam) => exam.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examId' })
  exam!: Exam;
  @Column('uuid') memberId!: string;
  @ManyToOne(() => Member, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'memberId' })
  member!: Member;
  @Column({ type: 'enum', enum: GradeType }) gradeType!: GradeType;
  @Column({ type: 'smallint' }) grade!: number;
  @Column({ type: 'enum', enum: ExamParticipantStatus, default: ExamParticipantStatus.Planned })
  status!: ExamParticipantStatus;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column('uuid') createdBy!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;
}
