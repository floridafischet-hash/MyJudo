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

  @Column({ type: 'varchar', length: 120, nullable: true, default: null })
  imageStoredName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, default: null })
  imageMimeType!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  imageOriginalName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, default: null })
  audioStoredName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, default: null })
  audioMimeType!: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  audioDurationMs!: number | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  deletedBy!: string | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  replyToId!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  replyToText!: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  editedAt!: Date | null;
}
