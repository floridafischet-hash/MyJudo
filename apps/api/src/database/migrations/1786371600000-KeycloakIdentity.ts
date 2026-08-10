import { MigrationInterface, QueryRunner } from 'typeorm';

export class KeycloakIdentity1786371600000 implements MigrationInterface {
  name = 'KeycloakIdentity1786371600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordHash"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "identityProviderSubject" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_identity_subject_active" ON "users" ("identityProviderSubject") WHERE "identityProviderSubject" IS NOT NULL AND "deletedAt" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_identity_subject_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "identityProviderSubject"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "passwordHash" varchar(255)`);
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "refreshTokenHash" char(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "revokedAt" timestamptz,
        "userAgent" varchar(500),
        "ipAddress" inet,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sessions_refresh_hash" UNIQUE ("refreshTokenHash"),
        CONSTRAINT "FK_sessions_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sessions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }
}
