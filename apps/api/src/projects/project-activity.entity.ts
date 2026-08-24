import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('project_activities')
export class ProjectActivity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') projectId!: string;
  @Column('uuid') actorUserId!: string;
  @Column({ type: 'varchar', length: 120 }) action!: string;
  @Column({ type: 'varchar', length: 500 }) description!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
