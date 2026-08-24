import { MigrationInterface, QueryRunner } from 'typeorm';

export class AvatarImages1787584800000 implements MigrationInterface {
  name = 'AvatarImages1787584800000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "avatarStoredName" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "avatarMimeType" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "groups" ADD "avatarStoredName" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "groups" ADD "avatarMimeType" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "chats" ADD "avatarStoredName" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "chats" ADD "avatarMimeType" character varying(120)`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chats" DROP COLUMN "avatarMimeType"`);
    await queryRunner.query(`ALTER TABLE "chats" DROP COLUMN "avatarStoredName"`);
    await queryRunner.query(`ALTER TABLE "groups" DROP COLUMN "avatarMimeType"`);
    await queryRunner.query(`ALTER TABLE "groups" DROP COLUMN "avatarStoredName"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarMimeType"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarStoredName"`);
  }
}
