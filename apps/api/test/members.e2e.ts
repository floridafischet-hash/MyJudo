import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { Organization } from '../src/organizations/organization.entity';
import { Role } from '../src/rbac/role.entity';
import { UserRole } from '../src/rbac/user-role.entity';
import { User } from '../src/users/user.entity';
import { UserStatus } from '../src/users/user-status.enum';
import { MemberGraduation } from '../src/members/member-graduation.entity';
import { buildGreenWorkbook } from './xlsx-fixture';

describe('Member import and administration', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organization: Organization;
  let accessToken: string;
  const pepper = 'test-password-pepper';
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://myjudo:test-password@127.0.0.1:15432/myjudo';
    process.env.APP_ORIGIN ??= 'http://localhost:8080';
    process.env.INITIAL_ORGANIZATION_SLUG ??= 'test-verein';
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-with-at-least-thirty-two-characters';
    process.env.PASSWORD_PEPPER = pepper;
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    organization = await dataSource
      .getRepository(Organization)
      .findOneByOrFail({ slug: 'test-verein' });
    const username = `import-admin-${suffix}`;
    const user = await dataSource.getRepository(User).save({
      organizationId: organization.id,
      email: `${username}@example.test`,
      username,
      passwordHash: await argon2.hash(`correct-password${pepper}`, { type: argon2.argon2id }),
      firstName: 'Import',
      lastName: 'Admin',
      status: UserStatus.Approved,
      approvedAt: new Date(),
      approvedBy: null,
    });
    const superuser = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'Superuser' });
    await dataSource
      .getRepository(UserRole)
      .save({ userId: user.id, roleId: superuser.id, assignedBy: user.id });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password: 'correct-password' })
      .expect(200);
    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('imports birth date, current grade and graduation history, stores them beyond the import, and skips invalid rows without aborting the batch', async () => {
    const currentYear = new Date().getUTCFullYear();
    const firstName = `ImportAlice${suffix}`;
    const buffer = buildGreenWorkbook(
      [
        'Vorname',
        'Nachname',
        'Geburtsdatum',
        'Höchste Graduierung',
        'Letzte Graduierung',
        'Bisherige Gürtel',
      ],
      [
        [
          firstName,
          'Testfrau',
          '15.06.1995',
          '2. Kyu - Blau',
          `12.03.${currentYear}`,
          `Judopass (J-1),2. Kyu - Blau (K-2),3. Kyu - Grün (K-3)`,
        ],
        // Missing last name: must be skipped as an error, not abort the batch.
        ['NamelessImport', '', '01.01.2000', '', '', ''],
      ],
    );

    const analyze = await request(app.getHttpServer())
      .post('/api/v1/members/import/analyze')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, 'members.xlsx')
      .expect(201);

    expect(analyze.body.rows).toHaveLength(2);
    const aliceRow = analyze.body.rows.find(
      (row: { data: { firstName: string } }) => row.data.firstName === firstName,
    );
    expect(aliceRow.status).toBe('new');
    expect(aliceRow.data.highestGraduation).toBe('2. Kyu - Blau');

    const decisions = analyze.body.rows.map((row: { rowId: string }) => ({
      rowId: row.rowId,
      action: 'create',
    }));
    const confirm = await request(app.getHttpServer())
      .post(`/api/v1/members/import/${analyze.body.jobId}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ decisions })
      .expect(201);

    expect(confirm.body.created).toBe(1);
    expect(confirm.body.errors).toBe(1);
    expect(confirm.body.errorDetails).toEqual([expect.objectContaining({ sourceRow: 3 })]);

    const list = await request(app.getHttpServer())
      .get('/api/v1/members')
      .query({ search: firstName })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    const member = list.body.items[0];
    expect(member.birthDate).toBe('1995-06-15');
    expect(member.highestGraduation).toBe('2. Kyu - Blau');
    expect(member.lastGraduationDate).toBe(`${currentYear}-03-12`);
    expect(member.graduationsThisYear).toBe(1);

    const graduations = await dataSource
      .getRepository(MemberGraduation)
      .findBy({ memberId: member.id });
    expect(graduations).toHaveLength(2);
    const current = graduations.find((g) => g.label === '2. Kyu - Blau');
    expect(current?.achievedOn).toBe(`${currentYear}-03-12`);
    const historic = graduations.find((g) => g.label === '3. Kyu - Grün');
    expect(historic?.achievedOn).toBeNull();

    // Re-importing the same person must update the existing record, not create a duplicate.
    const secondAnalyze = await request(app.getHttpServer())
      .post('/api/v1/members/import/analyze')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, 'members.xlsx')
      .expect(201);
    const aliceAgain = secondAnalyze.body.rows.find(
      (row: { data: { firstName: string } }) => row.data.firstName === firstName,
    );
    expect(aliceAgain.status).toBe('unchanged');
    expect(aliceAgain.memberId).toBe(member.id);

    await request(app.getHttpServer())
      .post(`/api/v1/members/import/${secondAnalyze.body.jobId}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        decisions: secondAnalyze.body.rows.map(
          (row: { rowId: string; status: string; memberId: string | null }) => ({
            rowId: row.rowId,
            action: row.status === 'conflict' ? 'skip' : 'update',
            memberId: row.memberId ?? undefined,
          }),
        ),
      })
      .expect(201);

    const listAfterReimport = await request(app.getHttpServer())
      .get('/api/v1/members')
      .query({ search: firstName })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(listAfterReimport.body.items).toHaveLength(1);
  });
});
