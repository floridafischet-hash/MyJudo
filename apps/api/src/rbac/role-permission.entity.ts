import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Entity('role_permissions')
@Index(['roleId', 'permissionId'], { unique: true })
export class RolePermission {
  @PrimaryColumn('uuid')
  roleId!: string;

  @PrimaryColumn('uuid')
  permissionId!: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId' })
  permission!: Permission;
}
