import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Project } from './project.entity';
import { User } from '../users/user.entity';

// One row per (user, project): the user's personal drag-and-drop position for
// that project. Only ever populated for projects the user can currently see
// in their active list - see ProjectsService.reorder/list - so it never
// affects other users' views or completed/inaccessible projects.
@Entity('project_orders')
export class ProjectOrder {
  @PrimaryColumn('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @PrimaryColumn('uuid') projectId!: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;
  @Column({ type: 'integer' }) position!: number;
}
