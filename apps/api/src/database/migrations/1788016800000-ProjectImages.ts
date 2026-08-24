import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectImages1788016800000 implements MigrationInterface {
  name = 'ProjectImages1788016800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "project_cards_type_enum" ADD VALUE IF NOT EXISTS 'image'`);
    await queryRunner.query(`ALTER TABLE project_cards
      ADD COLUMN "imageStoredName" varchar(120),
      ADD COLUMN "imageMimeType" varchar(120),
      ADD COLUMN "imageOriginalName" varchar(255)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE project_cards
      DROP COLUMN "imageOriginalName",
      DROP COLUMN "imageMimeType",
      DROP COLUMN "imageStoredName"`);
  }
}
