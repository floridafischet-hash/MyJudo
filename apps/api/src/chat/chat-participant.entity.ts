import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../users/user.entity';

@Entity('chat_participants')
@Index(['userId', 'leftAt'])
export class ChatParticipant {
  @PrimaryColumn('uuid')
  chatId!: string;

  @PrimaryColumn('uuid')
  userId!: string;

  @ManyToOne(() => Chat, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat!: Chat;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  leftAt!: Date | null;
}
