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

describe('Local authentication and application RBAC', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organization: Organization;
  const pepper = 'test-password-pepper';
  const suffix = Date.now().toString(36);
  const usernames = {
    florian: `florian-${suffix}`,
    stefan: `stefan-${suffix}`,
    member: `mitglied-${suffix}`,
  };

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
    const florian = await createUser(usernames.florian, 'Florian', 'correct-password');
    const stefan = await createUser(usernames.stefan, 'Stefan', 'kurz');
    const member = await createUser(usernames.member, 'Mina', 'member-password');
    const superuser = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'Superuser' });
    const memberRole = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'Mitglied / Eltern' });
    for (const user of [florian, stefan]) {
      await dataSource
        .getRepository(UserRole)
        .save({ userId: user.id, roleId: superuser.id, assignedBy: florian.id });
    }
    await dataSource
      .getRepository(UserRole)
      .save({ userId: member.id, roleId: memberRole.id, assignedBy: florian.id });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it.each([
    [usernames.florian, 'correct-password', 'Florian'],
    [usernames.stefan, 'kurz', 'Stefan'],
  ])('authenticates %s and returns the dynamic profile', async (username, password, firstName) => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    expect(login.body).toEqual(expect.objectContaining({ username, firstName }));
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(200);
  });

  it('rejects invalid credentials without disclosing which field was wrong', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: usernames.florian, password: 'wrong-password' })
      .expect(401);
    expect(response.body.message).toBe('Anmeldung fehlgeschlagen.');
  });

  it('rotates refresh tokens and revokes them on logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: usernames.florian, password: 'correct-password' })
      .expect(200);
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);
  });

  it('denies administrative endpoints to a normal member', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: usernames.member, password: 'member-password' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(403);
  });

  async function createUser(username: string, firstName: string, password: string): Promise<User> {
    return dataSource.getRepository(User).save({
      organizationId: organization.id,
      email: `${username}@example.test`,
      username,
      passwordHash: await argon2.hash(`${password}${pepper}`, { type: argon2.argon2id }),
      firstName,
      lastName: 'Test',
      status: UserStatus.Approved,
      approvedAt: new Date(),
      approvedBy: null,
    });
  }
});
