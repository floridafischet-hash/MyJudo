import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../users/user.entity';
import { ProjectCard } from './project-card.entity';
@Entity('checklist_items')
export class ChecklistItem extends BaseEntity {
  @Column('uuid') cardId!: string;
  @ManyToOne(() => ProjectCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cardId' })
  card!: ProjectCard;
  @Column({ type: 'varchar', length: 300 }) text!: string;
  @Column({ default: false }) completed!: boolean;
  @Column({ type: 'uuid', nullable: true }) completedBy!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'completedBy' })
  completer!: User | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
  @Column({ type: 'integer', default: 0 }) position!: number;
}
