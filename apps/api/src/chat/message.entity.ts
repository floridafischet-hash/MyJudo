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
}
