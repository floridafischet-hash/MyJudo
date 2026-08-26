import { MigrationInterface, QueryRunner } from 'typeorm';
export class ProjectFilesAndDownloadCategories1788103200000 implements MigrationInterface {
  name = 'ProjectFilesAndDownloadCategories1788103200000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE project_files(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,"uploadedBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,"originalName" varchar(255) NOT NULL,"storedName" varchar(120) NOT NULL UNIQUE,"mimeType" varchar(160) NOT NULL,size bigint NOT NULL CHECK(size>0 AND size<=10485760),"createdAt" timestamptz NOT NULL DEFAULT now());CREATE INDEX "IDX_project_files_project_created" ON project_files("projectId","createdAt")`,
    );
    await q.query(
      `CREATE TABLE download_categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,name varchar(120) NOT NULL,position integer NOT NULL DEFAULT 0,"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now(),UNIQUE("organizationId",name))`,
    );
    await q.query(
      `ALTER TABLE downloads ADD COLUMN "categoryId" uuid REFERENCES download_categories(id) ON DELETE SET NULL`,
    );
    await q.query(
      `INSERT INTO download_categories("organizationId",name,position) SELECT DISTINCT "organizationId", CASE category::text WHEN 'graduation' THEN 'Graduierungsübersichten' WHEN 'club' THEN 'Vereinsdokumente' WHEN 'training' THEN 'Trainingsunterlagen' WHEN 'form' THEN 'Formulare' ELSE 'Sonstiges' END, CASE category::text WHEN 'graduation' THEN 1 WHEN 'club' THEN 2 WHEN 'training' THEN 3 WHEN 'form' THEN 4 ELSE 5 END FROM downloads ON CONFLICT DO NOTHING`,
    );
    await q.query(
      `UPDATE downloads d SET "categoryId"=c.id FROM download_categories c WHERE c."organizationId"=d."organizationId" AND c.name=CASE d.category::text WHEN 'graduation' THEN 'Graduierungsübersichten' WHEN 'club' THEN 'Vereinsdokumente' WHEN 'training' THEN 'Trainingsunterlagen' WHEN 'form' THEN 'Formulare' ELSE 'Sonstiges' END`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE downloads DROP COLUMN "categoryId"`);
    await q.query(`DROP TABLE download_categories`);
    await q.query(`DROP TABLE project_files`);
  }
}
