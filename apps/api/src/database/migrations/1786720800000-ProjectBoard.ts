import { MigrationInterface, QueryRunner } from 'typeorm';
export class ProjectBoard1786720800000 implements MigrationInterface {
  name = 'ProjectBoard1786720800000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TYPE "projects_status_enum" AS ENUM ('active','completed','archived'); CREATE TYPE "project_members_access_enum" AS ENUM ('admin','edit','read'); CREATE TYPE "project_cards_type_enum" AS ENUM ('task','information','idea','appointment','note','checklist')`,
    );
    await q.query(
      `CREATE TABLE projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now(),"deletedAt" timestamptz,"organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,"createdBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,title varchar(160) NOT NULL,description varchar(1000),status projects_status_enum NOT NULL DEFAULT 'active',"startDate" date,"targetDate" date,category varchar(80))`,
    );
    await q.query(
      `CREATE TABLE project_members ("projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,"userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,access project_members_access_enum NOT NULL,PRIMARY KEY("projectId","userId",access),UNIQUE("projectId","userId"))`,
    );
    await q.query(
      `CREATE TABLE project_cards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now(),"deletedAt" timestamptz,"projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,"createdBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,type project_cards_type_enum NOT NULL,title varchar(160) NOT NULL,content text,position integer NOT NULL DEFAULT 0)`,
    );
    await q.query(
      `CREATE TABLE checklist_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now(),"deletedAt" timestamptz,"cardId" uuid NOT NULL REFERENCES project_cards(id) ON DELETE CASCADE,text varchar(300) NOT NULL,completed boolean NOT NULL DEFAULT false,"completedBy" uuid REFERENCES users(id) ON DELETE SET NULL,"completedAt" timestamptz,position integer NOT NULL DEFAULT 0)`,
    );
    await q.query(
      `CREATE TABLE project_activities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,"actorUserId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,action varchar(120) NOT NULL,description varchar(500) NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE INDEX "IDX_projects_org" ON projects("organizationId"); CREATE INDEX "IDX_project_members_user" ON project_members("userId"); CREATE INDEX "IDX_project_cards_project" ON project_cards("projectId"); CREATE INDEX "IDX_project_activity_project" ON project_activities("projectId","createdAt")`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `DROP TABLE project_activities; DROP TABLE checklist_items; DROP TABLE project_cards; DROP TABLE project_members; DROP TABLE projects; DROP TYPE project_cards_type_enum; DROP TYPE project_members_access_enum; DROP TYPE projects_status_enum`,
    );
  }
}
