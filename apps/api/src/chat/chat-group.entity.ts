import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Group } from '../training/group.entity';
import { Chat } from './chat.entity';

@Entity('chat_groups')
export class ChatGroup {
  @PrimaryColumn('uuid')
  chatId!: string;

  @PrimaryColumn('uuid')
  groupId!: string;

  @ManyToOne(() => Chat, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat!: Chat;

  @ManyToOne(() => Group, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group!: Group;
}
