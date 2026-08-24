import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectOrders1787844000000 implements MigrationInterface {
  name = 'ProjectOrders1787844000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE project_orders(
      "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      position integer NOT NULL,
      PRIMARY KEY("userId","projectId")
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_project_orders_user" ON project_orders("userId")`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE project_orders`);
  }
}
