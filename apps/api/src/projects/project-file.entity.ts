import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from '../users/user.entity';

@Entity('project_files')
@Index(['projectId', 'createdAt'])
export class ProjectFile {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') projectId!: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;
  @Column('uuid') uploadedBy!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploadedBy' })
  uploader!: User;
  @Column({ length: 255 }) originalName!: string;
  @Column({ length: 120, unique: true }) storedName!: string;
  @Column({ length: 160 }) mimeType!: string;
  @Column({ type: 'bigint' }) size!: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
