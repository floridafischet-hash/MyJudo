import { MigrationInterface, QueryRunner } from 'typeorm';

export class Exams1786389600000 implements MigrationInterface {
  name = 'Exams1786389600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "exam_participants_gradeType_enum" AS ENUM ('kyu','dan')`);
    await queryRunner.query(
      `CREATE TYPE "exam_participants_status_enum" AS ENUM ('planned','registered','passed','failed','withdrawn')`,
    );
    await queryRunner.query(`CREATE TABLE "exams" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "title" varchar(180) NOT NULL,
      "examDate" date NOT NULL, "location" varchar(240), "notes" text,
      "createdBy" uuid NOT NULL,
      CONSTRAINT "PK_exams" PRIMARY KEY ("id"),
      CONSTRAINT "FK_exams_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_exams_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_exams_org_date" ON "exams" ("organizationId", "examDate")`,
    );
    await queryRunner.query(`CREATE TABLE "exam_participants" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "examId" uuid NOT NULL, "memberId" uuid NOT NULL,
      "gradeType" "exam_participants_gradeType_enum" NOT NULL, "grade" smallint NOT NULL,
      "status" "exam_participants_status_enum" NOT NULL DEFAULT 'planned', "notes" text,
      "createdBy" uuid NOT NULL,
      CONSTRAINT "PK_exam_participants" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_exam_participant_member" UNIQUE ("examId", "memberId"),
      CONSTRAINT "CK_exam_grade" CHECK (("gradeType" = 'kyu' AND "grade" BETWEEN 1 AND 8) OR ("gradeType" = 'dan' AND "grade" BETWEEN 1 AND 10)),
      CONSTRAINT "FK_exam_participants_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_exam_participants_exam" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_exam_participants_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_exam_participants_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_exam_participants_org_status" ON "exam_participants" ("organizationId", "status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "exam_participants"`);
    await queryRunner.query(`DROP TABLE "exams"`);
    await queryRunner.query(`DROP TYPE "exam_participants_status_enum"`);
    await queryRunner.query(`DROP TYPE "exam_participants_gradeType_enum"`);
  }
}
