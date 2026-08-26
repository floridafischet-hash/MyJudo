import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { DownloadFolder } from './download-category.entity';
export enum DownloadCategory {
  Graduation = 'graduation',
  Club = 'club',
  Training = 'training',
  Form = 'form',
  Other = 'other',
}
@Entity('downloads')
export class Download extends BaseEntity {
  @Column('uuid') organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
  @Column('uuid') uploadedBy!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploadedBy' })
  uploader!: User;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'varchar', length: 1000, nullable: true }) description!: string | null;
  @Column({ type: 'enum', enum: DownloadCategory, enumName: 'downloads_category_enum' })
  category!: DownloadCategory;
  @Column({ type: 'uuid', nullable: true }) categoryId!: string | null;
  @ManyToOne(() => DownloadFolder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  folder!: DownloadFolder | null;
  @Column({ default: true }) active!: boolean;
  @Column({ default: false }) availableToAll!: boolean;
  @Column({ type: 'varchar', length: 255 }) originalName!: string;
  @Column({ type: 'varchar', length: 120 }) storedName!: string;
  @Column({ type: 'varchar', length: 120 }) mimeType!: string;
  @Column({ type: 'bigint' }) size!: number;
}
