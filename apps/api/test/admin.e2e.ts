import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { AuditLog } from '../src/audit/audit-log.entity';
import { Chat, ChatType } from '../src/chat/chat.entity';
import { Invitation } from '../src/invitations/invitation.entity';
import { Member } from '../src/members/member.entity';
import { Organization } from '../src/organizations/organization.entity';
import { Role } from '../src/rbac/role.entity';
import { UserRole } from '../src/rbac/user-role.entity';
import { User } from '../src/users/user.entity';
import { UserStatus } from '../src/users/user-status.enum';

describe('Local authentication and application RBAC', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organization: Organization;
  let florian: User;
  let stefan: User;
  let member: User;
  let adminToken: string;
  let stefanToken: string;
  let memberToken: string;
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
    florian = await createUser(usernames.florian, 'Florian', 'correct-password');
    stefan = await createUser(usernames.stefan, 'Stefan', 'stefan-password');
    member = await createUser(usernames.member, 'Mina', 'member-password');
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
    const jwt = app.get(JwtService);
    const tokens = await Promise.all(
      [florian, stefan, member].map((user) =>
        jwt.signAsync(
          { sub: user.id, org: user.organizationId, av: user.authorizationVersion },
          {
            secret: process.env.JWT_ACCESS_SECRET,
            expiresIn: 300,
            issuer: 'myjudo-api',
            audience: 'myjudo-client',
          },
        ),
      ),
    );
    adminToken = tokens[0]!;
    stefanToken = tokens[1]!;
    memberToken = tokens[2]!;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it.each([
    [usernames.florian, 'correct-password', 'Florian'],
    [usernames.stefan, 'stefan-password', 'Stefan'],
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

  it('keeps invitation tokens hashed and revocable', async () => {
    const invitation = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `invited-${suffix}@example.test`, expiresInHours: 24 })
      .expect(201);
    const stored = await dataSource
      .getRepository(Invitation)
      .findOneByOrFail({ id: invitation.body.id as string });
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(invitation.body.token);
    await request(app.getHttpServer())
      .post(`/api/v1/invitations/${invitation.body.id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('edits members with validation, RBAC and audit logging', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberNumber: `EDIT-${suffix}`, firstName: 'Vorher', lastName: 'Test' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${created.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ firstName: 'Nicht erlaubt' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Aktualisiert' })
      .expect(200)
      .expect(({ body }) => expect(body.firstName).toBe('Aktualisiert'));
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
    expect(
      await dataSource.getRepository(AuditLog).countBy({
        entityId: created.body.id as string,
        action: 'member.updated',
      }),
    ).toBe(1);
    expect(await dataSource.getRepository(Member).findOneByOrFail({ id: created.body.id })).toEqual(
      expect.objectContaining({ firstName: 'Aktualisiert' }),
    );
  });

  it('protects direct and PSG chats on every request and tracks unread messages', async () => {
    const direct = await request(app.getHttpServer())
      .post('/api/v1/chats/direct')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ participantUserId: stefan.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/chats/${direct.body.id}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ text: '  Sichere Direktnachricht  ' })
      .expect(201)
      .expect(({ body }) => expect(body.text).toBe('Sichere Direktnachricht'));
    await request(app.getHttpServer())
      .get(`/api/v1/chats/${direct.body.id}/messages`)
      .set('Authorization', `Bearer ${stefanToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/chats/${direct.body.id}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/chats')
      .set('Authorization', `Bearer ${stefanToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: direct.body.id, unreadCount: 1 })]),
        ),
      );

    const psgChat = await dataSource.getRepository(Chat).save({
      organizationId: organization.id,
      type: ChatType.Group,
      title: 'PSG Test',
      requiredPermission: 'chat.psg.access',
      systemKey: `psg-${suffix}`,
      directKey: null,
      createdBy: florian.id,
    });
    await request(app.getHttpServer())
      .get(`/api/v1/chats/${psgChat.id}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(404);
    const psgRole = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'PSG / Kinderschutz' });
    await dataSource.getRepository(UserRole).save({
      userId: member.id,
      roleId: psgRole.id,
      assignedBy: florian.id,
    });
    await request(app.getHttpServer())
      .get(`/api/v1/chats/${psgChat.id}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    await dataSource.getRepository(UserRole).delete({ userId: member.id, roleId: psgRole.id });
    await request(app.getHttpServer())
      .get(`/api/v1/chats/${psgChat.id}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(404);
  });

  async function createUser(username: string, firstName: string, password: string): Promise<User> {
    return dataSource.getRepository(User).save({
      organizationId: organization.id,
      email: `${username}@example.test`,
      passwordHash: await argon2.hash(`${password}${pepper}`, { type: argon2.argon2id }),
      firstName,
      lastName: 'Test',
      status: UserStatus.Approved,
      approvedAt: new Date(),
      approvedBy: null,
    });
  }
});
