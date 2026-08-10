import { MigrationInterface, QueryRunner } from 'typeorm';

export class Polls1786382400000 implements MigrationInterface {
  name = 'Polls1786382400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "polls_type_enum" AS ENUM ('attendance','choice')`);
    await queryRunner.query(`CREATE TABLE "polls" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "type" "polls_type_enum" NOT NULL,
      "title" varchar(180) NOT NULL, "description" text,
      "startsAt" timestamptz NOT NULL, "endsAt" timestamptz NOT NULL,
      "requiredPermission" varchar(120), "resultsVisibleToParticipants" boolean NOT NULL DEFAULT false,
      "createdBy" uuid NOT NULL,
      CONSTRAINT "PK_polls" PRIMARY KEY ("id"),
      CONSTRAINT "CK_polls_time_range" CHECK ("endsAt" > "startsAt"),
      CONSTRAINT "FK_polls_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_polls_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_polls_org_ends" ON "polls" ("organizationId", "endsAt")`,
    );
    await queryRunner.query(`CREATE TABLE "poll_options" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "pollId" uuid NOT NULL,
      "label" varchar(160) NOT NULL, "position" smallint NOT NULL,
      CONSTRAINT "PK_poll_options" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_poll_options_position" UNIQUE ("pollId", "position"),
      CONSTRAINT "UQ_poll_options_poll_id" UNIQUE ("pollId", "id"),
      CONSTRAINT "FK_poll_options_poll" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE "poll_votes" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "pollId" uuid NOT NULL,
      "optionId" uuid NOT NULL, "userId" uuid NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_poll_votes" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_poll_votes_user" UNIQUE ("pollId", "userId"),
      CONSTRAINT "FK_poll_votes_poll" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_poll_votes_option" FOREIGN KEY ("pollId", "optionId") REFERENCES "poll_options"("pollId", "id") ON DELETE CASCADE,
      CONSTRAINT "FK_poll_votes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_poll_votes_option" ON "poll_votes" ("optionId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_poll_votes_option"`);
    await queryRunner.query(`DROP TABLE "poll_votes"`);
    await queryRunner.query(`DROP TABLE "poll_options"`);
    await queryRunner.query(`DROP INDEX "IDX_polls_org_ends"`);
    await queryRunner.query(`DROP TABLE "polls"`);
    await queryRunner.query(`DROP TYPE "polls_type_enum"`);
  }
}
