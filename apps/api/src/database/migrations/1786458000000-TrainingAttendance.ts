import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrainingAttendance1786458000000 implements MigrationInterface {
  name = 'TrainingAttendance1786458000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE "attendances_status_enum" AS ENUM ('yes','no')`);
    await q.query(`CREATE TABLE "groups" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "name" varchar(100) NOT NULL, "description" varchar(500),
      "minimumAge" smallint, "maximumAge" smallint, "active" boolean NOT NULL DEFAULT true,
      CONSTRAINT "PK_groups" PRIMARY KEY ("id"),
      CONSTRAINT "CK_groups_age" CHECK (("minimumAge" IS NULL OR "minimumAge" >= 0) AND ("maximumAge" IS NULL OR "maximumAge" >= COALESCE("minimumAge", 0))),
      CONSTRAINT "FK_groups_org" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE)`);
    await q.query(
      `CREATE UNIQUE INDEX "IDX_groups_org_name_active" ON "groups" ("organizationId","name") WHERE "deletedAt" IS NULL`,
    );
    await q.query(`CREATE TABLE "user_groups" (
      "userId" uuid NOT NULL, "groupId" uuid NOT NULL, "assignedBy" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_user_groups" PRIMARY KEY ("userId","groupId","assignedBy"),
      CONSTRAINT "UQ_user_groups_user_group" UNIQUE ("userId","groupId"),
      CONSTRAINT "FK_user_groups_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_user_groups_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_user_groups_assigner" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT)`);
    await q.query(`CREATE TABLE "training_schedules" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "name" varchar(120) NOT NULL, "weekday" smallint NOT NULL,
      "startTime" time NOT NULL, "endTime" time NOT NULL, "validFrom" date, "validUntil" date,
      "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_training_schedules" PRIMARY KEY ("id"),
      CONSTRAINT "CK_training_schedule_weekday" CHECK ("weekday" BETWEEN 1 AND 7),
      CONSTRAINT "CK_training_schedule_times" CHECK ("endTime" > "startTime"),
      CONSTRAINT "CK_training_schedule_dates" CHECK ("validUntil" IS NULL OR "validFrom" IS NULL OR "validUntil" >= "validFrom"),
      CONSTRAINT "FK_training_schedules_org" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE)`);
    await q.query(
      `CREATE INDEX "IDX_training_schedules_org_weekday" ON "training_schedules" ("organizationId","weekday","active")`,
    );
    await q.query(`CREATE TABLE "training_groups" (
      "trainingScheduleId" uuid NOT NULL, "groupId" uuid NOT NULL,
      CONSTRAINT "PK_training_groups" PRIMARY KEY ("trainingScheduleId","groupId"),
      CONSTRAINT "FK_training_groups_schedule" FOREIGN KEY ("trainingScheduleId") REFERENCES "training_schedules"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_training_groups_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE)`);
    await q.query(`CREATE TABLE "training_sessions" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "trainingScheduleId" uuid NOT NULL,
      "startsAt" timestamptz NOT NULL, "endsAt" timestamptz NOT NULL, "cancelled" boolean NOT NULL DEFAULT false,
      CONSTRAINT "PK_training_sessions" PRIMARY KEY ("id"),
      CONSTRAINT "CK_training_sessions_times" CHECK ("endsAt" > "startsAt"),
      CONSTRAINT "FK_training_sessions_org" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_training_sessions_schedule" FOREIGN KEY ("trainingScheduleId") REFERENCES "training_schedules"("id") ON DELETE CASCADE)`);
    await q.query(
      `CREATE UNIQUE INDEX "IDX_training_sessions_schedule_start" ON "training_sessions" ("trainingScheduleId","startsAt")`,
    );
    await q.query(
      `CREATE INDEX "IDX_training_sessions_org_start" ON "training_sessions" ("organizationId","startsAt")`,
    );
    await q.query(`CREATE TABLE "attendances" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "userId" uuid NOT NULL, "trainingSessionId" uuid NOT NULL,
      "status" "attendances_status_enum" NOT NULL, "respondedAt" timestamptz NOT NULL,
      CONSTRAINT "PK_attendances" PRIMARY KEY ("id"),
      CONSTRAINT "FK_attendances_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_attendances_session" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE)`);
    await q.query(
      `CREATE UNIQUE INDEX "IDX_attendances_user_session" ON "attendances" ("userId","trainingSessionId") WHERE "deletedAt" IS NULL`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "attendances"`);
    await q.query(`DROP TYPE "attendances_status_enum"`);
    await q.query(`DROP TABLE "training_sessions"`);
    await q.query(`DROP TABLE "training_groups"`);
    await q.query(`DROP TABLE "training_schedules"`);
    await q.query(`DROP TABLE "user_groups"`);
    await q.query(`DROP TABLE "groups"`);
  }
}
