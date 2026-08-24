import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatVoiceMessages1787412000000 implements MigrationInterface {
  name = 'ChatVoiceMessages1787412000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE messages ADD "audioStoredName" varchar(120),ADD "audioMimeType" varchar(120),ADD "audioDurationMs" integer`,
    );
    await q.query(`ALTER TABLE messages DROP CONSTRAINT "CK_messages_text"`);
    await q.query(`
      ALTER TABLE messages ADD CONSTRAINT "CK_messages_text" CHECK (
        char_length(btrim("text")) <= 4000
        AND (
          char_length(btrim("text")) >= 1
          OR "imageStoredName" IS NOT NULL
          OR "audioStoredName" IS NOT NULL
        )
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE messages DROP CONSTRAINT "CK_messages_text"`);
    await q.query(`
      ALTER TABLE messages ADD CONSTRAINT "CK_messages_text" CHECK (
        char_length(btrim("text")) <= 4000
        AND (char_length(btrim("text")) >= 1 OR "imageStoredName" IS NOT NULL)
      )
    `);
    await q.query(
      `ALTER TABLE messages DROP COLUMN "audioDurationMs",DROP COLUMN "audioMimeType",DROP COLUMN "audioStoredName"`,
    );
  }
}
