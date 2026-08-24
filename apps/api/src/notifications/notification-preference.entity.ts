import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';

@Entity('notification_preferences')
@Index(['userId'], { unique: true, where: '"deletedAt" IS NULL' })
export class NotificationPreference extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  chatMessages!: boolean;

  @Column({ type: 'boolean', default: false })
  showMessagePreview!: boolean;
}
