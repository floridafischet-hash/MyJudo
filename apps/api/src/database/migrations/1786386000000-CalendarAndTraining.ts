import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarAndTraining1786386000000 implements MigrationInterface {
  name = 'CalendarAndTraining1786386000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "calendars_type_enum" AS ENUM ('private','club','trainer','youth','board','exams','association')`,
    );
    await queryRunner.query(
      `CREATE TYPE "calendar_events_status_enum" AS ENUM ('scheduled','cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "calendar_events_source_enum" AS ENUM ('club','njv','djb')`,
    );
    await queryRunner.query(`CREATE TABLE "calendars" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "type" "calendars_type_enum" NOT NULL,
      "name" varchar(160) NOT NULL, "ownerUserId" uuid, "requiredPermission" varchar(120),
      "systemKey" varchar(80), "createdBy" uuid NOT NULL,
      CONSTRAINT "PK_calendars" PRIMARY KEY ("id"),
      CONSTRAINT "CK_calendars_owner" CHECK (("type" = 'private') = ("ownerUserId" IS NOT NULL)),
      CONSTRAINT "FK_calendars_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_calendars_owner" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_calendars_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_calendars_org_system" ON "calendars" ("organizationId", "systemKey") WHERE "systemKey" IS NOT NULL AND "deletedAt" IS NULL`,
    );
    await queryRunner.query(`CREATE TABLE "calendar_events" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "calendarId" uuid NOT NULL,
      "title" varchar(200) NOT NULL, "description" text,
      "startsAt" timestamptz NOT NULL, "endsAt" timestamptz NOT NULL,
      "allDay" boolean NOT NULL DEFAULT false, "location" varchar(240),
      "status" "calendar_events_status_enum" NOT NULL DEFAULT 'scheduled',
      "source" "calendar_events_source_enum" NOT NULL DEFAULT 'club',
      "sourceExternalId" varchar(255), "sourceUrl" varchar(1000), "createdBy" uuid NOT NULL,
      CONSTRAINT "PK_calendar_events" PRIMARY KEY ("id"),
      CONSTRAINT "CK_calendar_events_time" CHECK ("endsAt" > "startsAt"),
      CONSTRAINT "FK_calendar_events_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_calendar_events_calendar" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_calendar_events_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_calendar_events_org_start" ON "calendar_events" ("organizationId", "startsAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_calendar_events_external" ON "calendar_events" ("calendarId", "source", "sourceExternalId") WHERE "sourceExternalId" IS NOT NULL AND "deletedAt" IS NULL`,
    );
    await queryRunner.query(`CREATE TABLE "training_sessions" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "name" varchar(160) NOT NULL,
      "weekday" smallint NOT NULL, "startsAt" time NOT NULL, "endsAt" time NOT NULL,
      "hall" varchar(160) NOT NULL, "location" varchar(240) NOT NULL,
      "ageGroup" varchar(120), "trainingGroup" varchar(120), "requiredPermission" varchar(120),
      "createdBy" uuid NOT NULL,
      CONSTRAINT "PK_training_sessions" PRIMARY KEY ("id"),
      CONSTRAINT "CK_training_weekday" CHECK ("weekday" BETWEEN 1 AND 7),
      CONSTRAINT "CK_training_time" CHECK ("endsAt" > "startsAt"),
      CONSTRAINT "FK_training_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_training_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_training_org_weekday_start" ON "training_sessions" ("organizationId", "weekday", "startsAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "training_sessions"`);
    await queryRunner.query(`DROP TABLE "calendar_events"`);
    await queryRunner.query(`DROP TABLE "calendars"`);
    await queryRunner.query(`DROP TYPE "calendar_events_source_enum"`);
    await queryRunner.query(`DROP TYPE "calendar_events_status_enum"`);
    await queryRunner.query(`DROP TYPE "calendars_type_enum"`);
  }
}
