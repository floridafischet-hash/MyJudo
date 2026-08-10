import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Poll } from './poll.entity';

@Entity('poll_options')
@Index(['pollId', 'position'], { unique: true })
@Index(['pollId', 'id'], { unique: true })
export class PollOption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  pollId!: string;

  @ManyToOne(() => Poll, (poll) => poll.options, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll!: Poll;

  @Column({ type: 'varchar', length: 160 })
  label!: string;

  @Column({ type: 'smallint' })
  position!: number;
}
