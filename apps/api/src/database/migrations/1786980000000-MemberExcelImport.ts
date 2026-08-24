import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemberExcelImport1786980000000 implements MigrationInterface {
  name = 'MemberExcelImport1786980000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE members ADD "gender" varchar(40),ADD "email" varchar(254),ADD "phone" varchar(80),ADD "street" varchar(180),ADD "postalCode" varchar(20),ADD "city" varchar(120),ADD "country" varchar(100),ADD "nationality" varchar(100),ADD "highestGraduation" varchar(120),ADD "lastGraduationDate" date,ADD "graduationsThisYear" integer`,
    );
    await q.query(
      `CREATE TABLE member_graduations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"memberId" uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,label varchar(120) NOT NULL,reference varchar(120),"createdAt" timestamptz NOT NULL DEFAULT now(),UNIQUE("memberId",label))`,
    );
    await q.query(
      `CREATE TABLE member_qualifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"memberId" uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,label varchar(180) NOT NULL,reference varchar(120),"createdAt" timestamptz NOT NULL DEFAULT now(),UNIQUE("memberId",label,reference))`,
    );
    await q.query(`CREATE TYPE member_import_status_enum AS ENUM ('preview','completed','failed')`);
    await q.query(
      `CREATE TABLE member_import_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,"actorUserId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,"fileName" varchar(255) NOT NULL,status member_import_status_enum NOT NULL,preview jsonb NOT NULL,summary jsonb,error text,"createdAt" timestamptz NOT NULL DEFAULT now(),"completedAt" timestamptz)`,
    );
    await q.query(
      `CREATE INDEX "IDX_member_import_jobs_org" ON member_import_jobs("organizationId","createdAt")`,
    );
    await q.query(
      `CREATE INDEX "IDX_members_identity" ON members("organizationId",lower("firstName"),lower("lastName"),"birthDate") WHERE "deletedAt" IS NULL`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DROP INDEX "IDX_members_identity";DROP TABLE member_import_jobs;DROP TYPE member_import_status_enum;DROP TABLE member_qualifications;DROP TABLE member_graduations`,
    );
    await q.query(
      `ALTER TABLE members DROP COLUMN "graduationsThisYear",DROP COLUMN "lastGraduationDate",DROP COLUMN "highestGraduation",DROP COLUMN "nationality",DROP COLUMN "country",DROP COLUMN "city",DROP COLUMN "postalCode",DROP COLUMN "street",DROP COLUMN "phone",DROP COLUMN "email",DROP COLUMN "gender"`,
    );
  }
}
