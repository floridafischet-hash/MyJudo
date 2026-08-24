import { Entity, PrimaryColumn } from 'typeorm';
@Entity('download_groups')
export class DownloadGroup {
  @PrimaryColumn('uuid') downloadId!: string;
  @PrimaryColumn('uuid') groupId!: string;
}
@Entity('download_roles')
export class DownloadRole {
  @PrimaryColumn('uuid') downloadId!: string;
  @PrimaryColumn('uuid') roleId!: string;
}
@Entity('download_users')
export class DownloadUser {
  @PrimaryColumn('uuid') downloadId!: string;
  @PrimaryColumn('uuid') userId!: string;
}
