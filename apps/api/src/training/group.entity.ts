import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';

@Entity('groups')
@Index(['organizationId', 'name'], { unique: true, where: '"deletedAt" IS NULL' })
export class Group extends BaseEntity {
  @Column('uuid') organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
  @Column({ type: 'varchar', length: 100 }) name!: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) description!: string | null;
  @Column({ type: 'smallint', nullable: true }) minimumAge!: number | null;
  @Column({ type: 'smallint', nullable: true }) maximumAge!: number | null;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @Column({ type: 'varchar', length: 7, nullable: true }) color!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) avatarStoredName!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) avatarMimeType!: string | null;
}
