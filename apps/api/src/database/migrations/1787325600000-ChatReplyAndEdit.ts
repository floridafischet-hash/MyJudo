import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatReplyAndEdit1787325600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS "replyToId" uuid DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "replyToText" text DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "editedAt" timestamptz DEFAULT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
        DROP COLUMN IF EXISTS "replyToId",
        DROP COLUMN IF EXISTS "replyToText",
        DROP COLUMN IF EXISTS "editedAt"
    `);
  }
}
