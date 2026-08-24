import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Project } from './project.entity';
export enum ProjectAccess {
  Admin = 'admin',
  Edit = 'edit',
  Read = 'read',
}
@Entity('project_members')
export class ProjectMember {
  @PrimaryColumn('uuid') projectId!: string;
  @PrimaryColumn('uuid') userId!: string;
  @PrimaryColumn({ type: 'enum', enum: ProjectAccess, enumName: 'project_members_access_enum' })
  access!: ProjectAccess;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user!: User;
}
