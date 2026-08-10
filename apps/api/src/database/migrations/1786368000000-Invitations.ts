import { MigrationInterface, QueryRunner } from 'typeorm';

export class Invitations1786368000000 implements MigrationInterface {
  name = 'Invitations1786368000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "invitations" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL,
      "tokenHash" char(64) NOT NULL, "email" varchar(320), "memberNumber" varchar(80),
      "expiresAt" timestamptz NOT NULL, "usedAt" timestamptz, "usedBy" uuid,
      "revokedAt" timestamptz, "invitedBy" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_invitations" PRIMARY KEY ("id"),
      CONSTRAINT "FK_invitations_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_invitations_used_by" FOREIGN KEY ("usedBy") REFERENCES "users"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_invitations_invited_by" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_invitations_token" ON "invitations" ("tokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invitations_org_expiry" ON "invitations" ("organizationId", "expiresAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "invitations"`);
  }
}
