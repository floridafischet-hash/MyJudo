import { MigrationInterface, QueryRunner } from 'typeorm';
export class ProtectedDownloads1786807200000 implements MigrationInterface {
  name = 'ProtectedDownloads1786807200000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TYPE downloads_category_enum AS ENUM ('graduation','club','training','form','other');CREATE TABLE downloads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now(),"deletedAt" timestamptz,"organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,"uploadedBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,title varchar(160) NOT NULL,description varchar(1000),category downloads_category_enum NOT NULL,active boolean NOT NULL DEFAULT true,"availableToAll" boolean NOT NULL DEFAULT false,"originalName" varchar(255) NOT NULL,"storedName" varchar(120) NOT NULL UNIQUE,"mimeType" varchar(120) NOT NULL,size bigint NOT NULL);CREATE INDEX "IDX_downloads_org" ON downloads("organizationId",active);CREATE TABLE download_groups("downloadId" uuid REFERENCES downloads(id) ON DELETE CASCADE,"groupId" uuid REFERENCES groups(id) ON DELETE CASCADE,PRIMARY KEY("downloadId","groupId"));CREATE TABLE download_roles("downloadId" uuid REFERENCES downloads(id) ON DELETE CASCADE,"roleId" uuid REFERENCES roles(id) ON DELETE CASCADE,PRIMARY KEY("downloadId","roleId"));CREATE TABLE download_users("downloadId" uuid REFERENCES downloads(id) ON DELETE CASCADE,"userId" uuid REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY("downloadId","userId"))`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `DROP TABLE download_users;DROP TABLE download_roles;DROP TABLE download_groups;DROP TABLE downloads;DROP TYPE downloads_category_enum`,
    );
  }
}
