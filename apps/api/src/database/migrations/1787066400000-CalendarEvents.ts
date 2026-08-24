import { MigrationInterface, QueryRunner } from 'typeorm';
export class CalendarEvents1787066400000 implements MigrationInterface {
  name = 'CalendarEvents1787066400000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE "calendar_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"deletedAt" TIMESTAMPTZ,"organizationId" uuid NOT NULL,"createdBy" uuid NOT NULL,"seriesId" uuid,"title" varchar(180) NOT NULL,"description" text,"startsAt" TIMESTAMPTZ NOT NULL,"endsAt" TIMESTAMPTZ NOT NULL,"location" varchar(180),"eventType" varchar(50) NOT NULL DEFAULT 'event',"groupIds" uuid[] NOT NULL DEFAULT '{}',"participantIds" uuid[] NOT NULL DEFAULT '{}',"reminderMinutes" integer,"recurrence" varchar(20) NOT NULL DEFAULT 'none',"recurrenceInterval" integer NOT NULL DEFAULT 1,"recurrenceUntil" date,"recurrenceCount" integer,CONSTRAINT "PK_calendar_events" PRIMARY KEY("id"),CONSTRAINT "FK_calendar_org" FOREIGN KEY("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,CONSTRAINT "FK_calendar_creator" FOREIGN KEY("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT)`,
    );
    await q.query(
      `CREATE INDEX "IDX_calendar_org_start" ON "calendar_events"("organizationId","startsAt")`,
    );
    await q.query(
      `CREATE INDEX "IDX_calendar_series_start" ON "calendar_events"("seriesId","startsAt")`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(`DROP TABLE "calendar_events"`);
  }
}
