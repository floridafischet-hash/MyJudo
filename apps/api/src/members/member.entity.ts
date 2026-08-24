import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { MemberStatus } from './member-status.enum';

@Entity('members')
@Index(['organizationId', 'memberNumber'], { unique: true, where: '"deletedAt" IS NULL' })
@Index(['organizationId', 'status', 'exitDate'])
export class Member extends BaseEntity {
  @Column('uuid') organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
  @Column({ type: 'uuid', nullable: true }) userId!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user!: User | null;
  @Column({ type: 'varchar', length: 80 }) memberNumber!: string;
  @Column({ type: 'varchar', length: 100 }) firstName!: string;
  @Column({ type: 'varchar', length: 100 }) lastName!: string;
  @Column({ type: 'date', nullable: true }) birthDate!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) gender!: string | null;
  @Column({ type: 'varchar', length: 254, nullable: true }) email!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) phone!: string | null;
  @Column({ type: 'varchar', length: 180, nullable: true }) street!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) postalCode!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) city!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) country!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) nationality!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) highestGraduation!: string | null;
  @Column({ type: 'date', nullable: true }) lastGraduationDate!: string | null;
  @Column({ type: 'integer', nullable: true }) graduationsThisYear!: number | null;
  @Column({ type: 'enum', enum: MemberStatus, default: MemberStatus.Active }) status!: MemberStatus;
  @Column({ type: 'date', nullable: true }) exitDate!: string | null;
  @Column('uuid') createdBy!: string;
}
