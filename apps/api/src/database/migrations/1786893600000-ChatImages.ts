import { MigrationInterface, QueryRunner } from 'typeorm';
export class ChatImages1786893600000 implements MigrationInterface {
  name = 'ChatImages1786893600000';
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TABLE messages ADD "imageStoredName" varchar(120),ADD "imageMimeType" varchar(120),ADD "imageOriginalName" varchar(255)`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `ALTER TABLE messages DROP COLUMN "imageOriginalName",DROP COLUMN "imageMimeType",DROP COLUMN "imageStoredName"`,
    );
  }
}
