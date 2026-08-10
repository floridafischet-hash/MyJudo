import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
@Index(['organizationId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'varchar', length: 120 })
  action!: string;

  @Column({ type: 'varchar', length: 80 })
  entityType!: string;

  @Column({ type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  outcome!: 'success' | 'failure';

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
