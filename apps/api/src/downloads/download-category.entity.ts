import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
@Entity('download_categories')
@Index(['organizationId', 'name'], { unique: true })
export class DownloadFolder {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') organizationId!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'integer', default: 0 }) position!: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
