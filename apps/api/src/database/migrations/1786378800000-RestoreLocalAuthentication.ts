import { MigrationInterface, QueryRunner } from 'typeorm';

export class RestoreLocalAuthentication1786378800000 implements MigrationInterface {
  name = 'RestoreLocalAuthentication1786378800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'passwordHash'
        ) THEN
          ALTER TABLE "users" ADD "passwordHash" varchar(255);
          UPDATE "users" SET "passwordHash" = 'local-login-disabled-until-password-reset';
          ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL;
        END IF;
      END $$`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "refreshTokenHash" char(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "revokedAt" timestamptz,
        "userAgent" varchar(500),
        "ipAddress" inet,
        CONSTRAINT "PK_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sessions_refresh_hash" UNIQUE ("refreshTokenHash"),
        CONSTRAINT "FK_sessions_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sessions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sessions_user" ON "sessions" ("userId")`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_identity_subject_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "identityProviderSubject"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "identityProviderSubject" uuid`);
    await queryRunner.query(`DROP INDEX "IDX_sessions_user"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordHash"`);
  }
}
