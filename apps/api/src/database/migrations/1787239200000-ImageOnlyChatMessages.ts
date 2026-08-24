import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImageOnlyChatMessages1787239200000 implements MigrationInterface {
  name = 'ImageOnlyChatMessages1787239200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages DROP CONSTRAINT "CK_messages_text"`);
    await queryRunner.query(`
      ALTER TABLE messages ADD CONSTRAINT "CK_messages_text" CHECK (
        char_length(btrim("text")) <= 4000
        AND (char_length(btrim("text")) >= 1 OR "imageStoredName" IS NOT NULL)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE messages SET "text" = 'Bild' WHERE btrim("text") = ''`);
    await queryRunner.query(`ALTER TABLE messages DROP CONSTRAINT "CK_messages_text"`);
    await queryRunner.query(`
      ALTER TABLE messages ADD CONSTRAINT "CK_messages_text"
      CHECK (char_length(btrim("text")) BETWEEN 1 AND 4000)
    `);
  }
}
