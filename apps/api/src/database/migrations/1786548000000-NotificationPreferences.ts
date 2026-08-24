import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferences1786548000000 implements MigrationInterface {
  name = 'NotificationPreferences1786548000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "notification_preferences" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "enabled" boolean NOT NULL DEFAULT false,
      "chatMessages" boolean NOT NULL DEFAULT true,
      "showMessagePreview" boolean NOT NULL DEFAULT false,
      CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
      CONSTRAINT "FK_notification_preferences_org" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_notification_preferences_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await q.query(
      `CREATE UNIQUE INDEX "IDX_notification_preferences_user_active" ON "notification_preferences" ("userId") WHERE "deletedAt" IS NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "notification_preferences"`);
  }
}
