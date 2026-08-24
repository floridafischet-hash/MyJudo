import { MigrationInterface, QueryRunner } from 'typeorm';

export class Usernames1786461600000 implements MigrationInterface {
  name = 'Usernames1786461600000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(100)`);
    await queryRunner.query(`UPDATE "users" SET "username" = lower(split_part("email", '@', 1))`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_org_username" ON "users" ("organizationId", "username") WHERE "deletedAt" IS NULL`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_org_username"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
  }
}
