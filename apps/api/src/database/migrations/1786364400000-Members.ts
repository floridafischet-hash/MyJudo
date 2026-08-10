import { MigrationInterface, QueryRunner } from 'typeorm';

export class Members1786364400000 implements MigrationInterface {
  name = 'Members1786364400000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "members_status_enum" AS ENUM ('active','exit_scheduled','former','suspended','archived')`,
    );
    await queryRunner.query(`CREATE TABLE "members" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      "organizationId" uuid NOT NULL, "userId" uuid, "memberNumber" varchar(80) NOT NULL,
      "firstName" varchar(100) NOT NULL, "lastName" varchar(100) NOT NULL, "birthDate" date,
      "status" "members_status_enum" NOT NULL DEFAULT 'active', "exitDate" date, "createdBy" uuid NOT NULL,
      CONSTRAINT "PK_members" PRIMARY KEY ("id"),
      CONSTRAINT "FK_members_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_members_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT,
      CONSTRAINT "CK_members_exit_date" CHECK ("status" <> 'exit_scheduled' OR "exitDate" IS NOT NULL)
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_members_org_number_active" ON "members" ("organizationId", "memberNumber") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_members_org_status_exit" ON "members" ("organizationId", "status", "exitDate")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "members"`);
    await queryRunner.query(`DROP TYPE "members_status_enum"`);
  }
}
