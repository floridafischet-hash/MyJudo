import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../users/user.entity';
import { Project } from './project.entity';
export enum ProjectCardType {
  Task = 'task',
  Information = 'information',
  Idea = 'idea',
  Appointment = 'appointment',
  Note = 'note',
  Checklist = 'checklist',
}
@Entity('project_cards')
export class ProjectCard extends BaseEntity {
  @Column('uuid') projectId!: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;
  @Column('uuid') createdBy!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;
  @Column({ type: 'enum', enum: ProjectCardType, enumName: 'project_cards_type_enum' })
  type!: ProjectCardType;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'text', nullable: true }) content!: string | null;
  @Column({ type: 'integer', default: 0 }) position!: number;
}
