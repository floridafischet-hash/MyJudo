import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';

export enum ChatType {
  Group = 'group',
  Direct = 'direct',
}

@Entity('chats')
@Index(['organizationId', 'directKey'], {
  unique: true,
  where: '"directKey" IS NOT NULL AND "deletedAt" IS NULL',
})
@Index(['organizationId', 'systemKey'], {
  unique: true,
  where: '"systemKey" IS NOT NULL AND "deletedAt" IS NULL',
})
@Index(['organizationId', 'type'])
export class Chat extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ type: 'enum', enum: ChatType, enumName: 'chats_type_enum' })
  type!: ChatType;

  @Column({ type: 'varchar', length: 160, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  icon!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  avatarStoredName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  avatarMimeType!: string | null;

  @Column({ type: 'boolean', default: false })
  archived!: boolean;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  requiredPermission!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  systemKey!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  directKey!: string | null;

  @Column({ type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;
}
