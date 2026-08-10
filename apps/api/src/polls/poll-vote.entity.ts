import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { PollOption } from './poll-option.entity';
import { Poll } from './poll.entity';

@Entity('poll_votes')
@Index(['pollId', 'userId'], { unique: true })
export class PollVote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  pollId!: string;

  @ManyToOne(() => Poll, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll!: Poll;

  @Column({ type: 'uuid' })
  optionId!: string;

  @ManyToOne(() => PollOption, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'optionId' })
  option!: PollOption;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
