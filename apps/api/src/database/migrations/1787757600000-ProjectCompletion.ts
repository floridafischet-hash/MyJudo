import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectCompletion1787757600000 implements MigrationInterface {
  name = 'ProjectCompletion1787757600000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" ADD "completedAt" timestamptz`);
    await queryRunner.query(
      `UPDATE "projects" SET "completedAt" = "updatedAt" WHERE status = 'completed'`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "completedAt"`);
  }
}
