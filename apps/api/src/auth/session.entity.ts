import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sessions')
@Index(['userId', 'expiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  refreshTokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
