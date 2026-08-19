import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../users/user.entity';
import { Chat } from './chat.entity';

@Entity('messages')
@Index(['chatId', 'createdAt', 'id'])
export class Message extends BaseEntity {
  @Column({ type: 'uuid' })
  chatId!: string;

  @ManyToOne(() => Chat, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat!: Chat;

  @Column({ type: 'uuid' })
  senderId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'uuid', nullable: true, default: null })
  replyToId!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  replyToText!: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  editedAt!: Date | null;
}
