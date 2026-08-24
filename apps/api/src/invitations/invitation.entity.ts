import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('invitations')
@Index(['tokenHash'], { unique: true })
@Index(['organizationId', 'expiresAt'])
export class Invitation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) organizationId!: string;
  @Column({ type: 'char', length: 64 }) tokenHash!: string;
  @Column({ type: 'varchar', length: 320, nullable: true }) email!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) memberNumber!: string | null;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) usedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) usedBy!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ type: 'uuid' }) invitedBy!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
