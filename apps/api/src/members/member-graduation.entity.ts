import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Member } from './member.entity';

@Entity('member_graduations')
@Index(['memberId', 'label'], { unique: true })
export class MemberGraduation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') memberId!: string;
  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'memberId' })
  member!: Member;
  @Column({ type: 'varchar', length: 120 }) label!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) reference!: string | null;
  @Column({ type: 'date', nullable: true }) achievedOn!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}

@Entity('member_qualifications')
@Index(['memberId', 'label', 'reference'], { unique: true })
export class MemberQualification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') memberId!: string;
  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'memberId' })
  member!: Member;
  @Column({ type: 'varchar', length: 180 }) label!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) reference!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}
