import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatFoundation1786375200000 implements MigrationInterface {
  name = 'ChatFoundation1786375200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "chats_type_enum" AS ENUM ('group','direct')`);
    await queryRunner.query(`
      CREATE TABLE "chats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz,
        "organizationId" uuid NOT NULL,
        "type" "chats_type_enum" NOT NULL,
        "title" varchar(160),
        "requiredPermission" varchar(120),
        "systemKey" varchar(80),
        "directKey" varchar(80),
        "createdBy" uuid NOT NULL,
        CONSTRAINT "PK_chats" PRIMARY KEY ("id"),
        CONSTRAINT "CK_chats_kind_fields" CHECK (
          ("type" = 'group' AND "title" IS NOT NULL AND "requiredPermission" IS NOT NULL AND "directKey" IS NULL)
          OR ("type" = 'direct' AND "title" IS NULL AND "requiredPermission" IS NULL AND "directKey" IS NOT NULL)
        ),
        CONSTRAINT "FK_chats_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chats_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_chats_org_type" ON "chats" ("organizationId", "type")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_chats_org_direct_active" ON "chats" ("organizationId", "directKey") WHERE "directKey" IS NOT NULL AND "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_chats_org_system_active" ON "chats" ("organizationId", "systemKey") WHERE "systemKey" IS NOT NULL AND "deletedAt" IS NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "chat_participants" (
        "chatId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "joinedAt" timestamptz NOT NULL DEFAULT now(),
        "lastReadAt" timestamptz,
        "leftAt" timestamptz,
        CONSTRAINT "PK_chat_participants" PRIMARY KEY ("chatId", "userId"),
        CONSTRAINT "FK_chat_participants_chat" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_participants_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_participants_user_left" ON "chat_participants" ("userId", "leftAt")`,
    );
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz,
        "chatId" uuid NOT NULL,
        "senderId" uuid NOT NULL,
        "text" text NOT NULL,
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CK_messages_text" CHECK (char_length(btrim("text")) BETWEEN 1 AND 4000),
        CONSTRAINT "FK_messages_chat" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_chat_created" ON "messages" ("chatId", "createdAt", "id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "chat_participants"`);
    await queryRunner.query(`DROP TABLE "chats"`);
    await queryRunner.query(`DROP TYPE "chats_type_enum"`);
  }
}
