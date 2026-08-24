import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Group } from './group.entity';

@Entity('user_groups')
export class UserGroup {
  @PrimaryColumn('uuid') userId!: string;
  @PrimaryColumn('uuid') groupId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group!: Group;
  @PrimaryColumn('uuid') assignedBy!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
