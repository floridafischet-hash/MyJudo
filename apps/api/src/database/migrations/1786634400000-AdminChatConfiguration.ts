import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminChatConfiguration1786634400000 implements MigrationInterface {
  name = 'AdminChatConfiguration1786634400000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "chats" ADD "description" varchar(500)`);
    await q.query(`ALTER TABLE "chats" ADD "icon" varchar(40)`);
    await q.query(`ALTER TABLE "chats" ADD "archived" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "chats" ADD "active" boolean NOT NULL DEFAULT true`);
    await q.query(`ALTER TABLE "chats" DROP CONSTRAINT "CK_chats_kind_fields"`);
    await q.query(`ALTER TABLE "chats" ADD CONSTRAINT "CK_chats_kind_fields" CHECK (
      ("type" = 'group' AND "title" IS NOT NULL AND "directKey" IS NULL)
      OR ("type" = 'direct' AND "title" IS NULL AND "requiredPermission" IS NULL AND "directKey" IS NOT NULL)
    )`);
    await q.query(`CREATE TABLE "chat_groups" (
      "chatId" uuid NOT NULL, "groupId" uuid NOT NULL,
      CONSTRAINT "PK_chat_groups" PRIMARY KEY ("chatId","groupId"),
      CONSTRAINT "FK_chat_groups_chat" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_chat_groups_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX "IDX_chat_groups_group" ON "chat_groups" ("groupId")`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "chat_groups"`);
    await q.query(`ALTER TABLE "chats" DROP CONSTRAINT "CK_chats_kind_fields"`);
    await q.query(`ALTER TABLE "chats" ADD CONSTRAINT "CK_chats_kind_fields" CHECK (
      ("type" = 'group' AND "title" IS NOT NULL AND "requiredPermission" IS NOT NULL AND "directKey" IS NULL)
      OR ("type" = 'direct' AND "title" IS NULL AND "requiredPermission" IS NULL AND "directKey" IS NOT NULL)
    )`);
    await q.query(`ALTER TABLE "chats" DROP COLUMN "active"`);
    await q.query(`ALTER TABLE "chats" DROP COLUMN "archived"`);
    await q.query(`ALTER TABLE "chats" DROP COLUMN "icon"`);
    await q.query(`ALTER TABLE "chats" DROP COLUMN "description"`);
  }
}
