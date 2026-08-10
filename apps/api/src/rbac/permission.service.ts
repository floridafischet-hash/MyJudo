import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PermissionService {
  constructor(private readonly dataSource: DataSource) {}

  async hasAll(userId: string, organizationId: string, required: string[]): Promise<boolean> {
    if (required.length === 0) return true;
    const rows: Array<{ key: string }> = await this.dataSource.query(
      `SELECT DISTINCT permission.key
       FROM permissions permission
       INNER JOIN role_permissions role_permission
         ON role_permission."permissionId" = permission.id
       INNER JOIN roles role ON role.id = role_permission."roleId"
       INNER JOIN user_roles user_role ON user_role."roleId" = role.id
       WHERE user_role."userId" = $1
         AND role."organizationId" = $2
         AND role."deletedAt" IS NULL
         AND permission.key = ANY($3::varchar[])`,
      [userId, organizationId, required],
    );
    return new Set(rows.map((row) => row.key)).size === new Set(required).size;
  }

  async listForUser(userId: string, organizationId: string): Promise<string[]> {
    const rows: Array<{ key: string }> = await this.dataSource.query(
      `SELECT DISTINCT permission.key
       FROM permissions permission
       INNER JOIN role_permissions role_permission ON role_permission."permissionId" = permission.id
       INNER JOIN roles role ON role.id = role_permission."roleId"
       INNER JOIN user_roles user_role ON user_role."roleId" = role.id
       WHERE user_role."userId" = $1 AND role."organizationId" = $2
         AND role."deletedAt" IS NULL AND permission."deletedAt" IS NULL
       ORDER BY permission.key`,
      [userId, organizationId],
    );
    return rows.map((row) => row.key);
  }
}
