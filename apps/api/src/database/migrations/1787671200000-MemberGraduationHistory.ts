import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemberGraduationHistory1787671200000 implements MigrationInterface {
  name = 'MemberGraduationHistory1787671200000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member_graduations" ADD "achievedOn" date`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member_graduations" DROP COLUMN "achievedOn"`);
  }
}
