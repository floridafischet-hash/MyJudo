import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum MemberImportStatus {
  Preview = 'preview',
  Completed = 'completed',
  Failed = 'failed',
}

@Entity('member_import_jobs')
export class MemberImportJob {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') organizationId!: string;
  @Column('uuid') actorUserId!: string;
  @Column({ type: 'varchar', length: 255 }) fileName!: string;
  @Column({ type: 'enum', enum: MemberImportStatus, enumName: 'member_import_status_enum' })
  status!: MemberImportStatus;
  @Column({ type: 'jsonb' }) preview!: Record<string, unknown>;
  @Column({ type: 'jsonb', nullable: true }) summary!: Record<string, unknown> | null;
  @Column({ type: 'text', nullable: true }) error!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}
