import { MigrationInterface, QueryRunner } from 'typeorm';

const PALETTE = [
  '#E53935',
  '#D81B60',
  '#8E24AA',
  '#5E35B1',
  '#3949AB',
  '#1E88E5',
  '#00897B',
  '#43A047',
  '#C0CA33',
  '#FB8C00',
  '#6D4C41',
  '#546E7A',
];

export class CalendarColors1787498400000 implements MigrationInterface {
  name = 'CalendarColors1787498400000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "groups" ADD "color" character varying(7)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "color" character varying(7)`);
    const values = PALETTE.map((c, i) => `('${c}',${i})`).join(',');
    await queryRunner.query(`
      WITH palette(color, idx) AS (VALUES ${values}),
      ranked AS (
        SELECT id, (row_number() OVER (ORDER BY "organizationId", name) - 1) % ${PALETTE.length} AS idx
        FROM "groups"
      )
      UPDATE "groups" g SET color = p.color FROM ranked r JOIN palette p ON p.idx = r.idx WHERE g.id = r.id
    `);
    await queryRunner.query(`
      WITH palette(color, idx) AS (VALUES ${values}),
      ranked AS (
        SELECT id, (row_number() OVER (ORDER BY "organizationId", "lastName", "firstName") - 1 + 5) % ${PALETTE.length} AS idx
        FROM "users"
      )
      UPDATE "users" u SET color = p.color FROM ranked r JOIN palette p ON p.idx = r.idx WHERE u.id = r.id
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "color"`);
    await queryRunner.query(`ALTER TABLE "groups" DROP COLUMN "color"`);
  }
}
