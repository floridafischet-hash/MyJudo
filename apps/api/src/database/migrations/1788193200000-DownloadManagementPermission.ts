import { MigrationInterface, QueryRunner } from 'typeorm';

export class DownloadManagementPermission1788193200000 implements MigrationInterface {
  name = 'DownloadManagementPermission1788193200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (id, key, description, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'downloads.manage', 'Downloads und Download-Kategorien verwalten', now(), now())
      ON CONFLICT (key) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO role_permissions ("roleId", "permissionId")
      SELECT existing."roleId", added.id
      FROM role_permissions existing
      JOIN permissions previous ON previous.id = existing."permissionId" AND previous.key = 'roles.manage'
      CROSS JOIN permissions added
      WHERE added.key = 'downloads.manage'
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM permissions WHERE key = 'downloads.manage'`);
  }
}
