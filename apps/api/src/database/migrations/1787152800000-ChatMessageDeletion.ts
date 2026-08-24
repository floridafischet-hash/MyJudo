import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatMessageDeletion1787152800000 implements MigrationInterface {
  name = 'ChatMessageDeletion1787152800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" ADD COLUMN "deletedBy" uuid NULL`);
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_messages_deleted_by" FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_messages_deleted_by"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "deletedBy"`);
  }
}
