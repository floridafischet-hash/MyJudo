import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarMeetingLinks1787930400000 implements MigrationInterface {
  name = 'CalendarMeetingLinks1787930400000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "calendar_meeting_provider_enum" AS ENUM ('google_meet','microsoft_teams','other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_events" ADD "meetingProvider" "calendar_meeting_provider_enum",ADD "meetingUrl" varchar(2048),ADD "meetingNotes" varchar(500)`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_events" DROP COLUMN "meetingNotes",DROP COLUMN "meetingUrl",DROP COLUMN "meetingProvider"`,
    );
    await queryRunner.query(`DROP TYPE "calendar_meeting_provider_enum"`);
  }
}
