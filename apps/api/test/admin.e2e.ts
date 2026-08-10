import { generateKeyPairSync, KeyObject } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Invitation } from '../src/invitations/invitation.entity';
import { Organization } from '../src/organizations/organization.entity';
import { Role } from '../src/rbac/role.entity';
import { UserRole } from '../src/rbac/user-role.entity';
import { User } from '../src/users/user.entity';
import { UserStatus } from '../src/users/user-status.enum';
import { Member } from '../src/members/member.entity';
import { MemberStatus } from '../src/members/member-status.enum';
import { AuditLog } from '../src/audit/audit-log.entity';

describe('Keycloak authentication and application RBAC', () => {
  jest.setTimeout(30_000);
  const keyId = 'test-key';
  const florianSubject = '00000000-0000-0000-0000-000000000001';
  const stefanSubject = '00000000-0000-0000-0000-000000000002';
  const memberSubject = '00000000-0000-0000-0000-000000000003';
  const invitedSubject = '00000000-0000-0000-0000-000000000004';
  let app: INestApplication;
  let dataSource: DataSource;
  let jwksServer: Server;
  let privateKey: KeyObject;
  let issuer: string;
  let florian: User;
  let stefan: User;
  let member: User;

  beforeAll(async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = keys.privateKey;
    const publicJwk = keys.publicKey.export({ format: 'jwk' });
    jwksServer = createServer((_, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({ keys: [{ ...publicJwk, kid: keyId, use: 'sig', alg: 'RS256' }] }),
      );
    });
    await new Promise<void>((resolve) => jwksServer.listen(9999, '127.0.0.1', resolve));
    const keycloakUrl = 'http://127.0.0.1:9999';
    issuer = `${keycloakUrl}/realms/myjudo`;
    process.env.KEYCLOAK_URL = keycloakUrl;
    process.env.KEYCLOAK_JWKS_URL = keycloakUrl;
    process.env.KEYCLOAK_REALM = 'myjudo';
    process.env.KEYCLOAK_CLIENT_ID = 'myjudo-client';
    process.env.KEYCLOAK_AUDIENCE = 'myjudo-api';

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    const organization = await dataSource
      .getRepository(Organization)
      .findOneByOrFail({ slug: 'test-verein' });
    florian = await ensureUser(organization.id, 'florian', 'Florian', florianSubject);
    stefan = await ensureUser(organization.id, 'stefan', 'Stefan', stefanSubject);
    member = await ensureUser(organization.id, 'mitglied', '', memberSubject);
    const superuser = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'Superuser' });
    const memberRole = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'Mitglied / Eltern' });
    for (const user of [florian, stefan]) {
      await dataSource
        .getRepository(UserRole)
        .upsert(
          { userId: user.id, roleId: superuser.id, assignedBy: florian.id },
          { conflictPaths: ['userId', 'roleId'], skipUpdateIfNoValuesChanged: true },
        );
    }
    await dataSource
      .getRepository(UserRole)
      .upsert(
        { userId: member.id, roleId: memberRole.id, assignedBy: florian.id },
        { conflictPaths: ['userId', 'roleId'], skipUpdateIfNoValuesChanged: true },
      );
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve, reject) =>
      jwksServer.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it.each([
    ['Florian', () => florian, florianSubject],
    ['Stefan', () => stefan, stefanSubject],
  ])('accepts %s as a dual-authorized superuser', async (firstName, getUser, subject) => {
    const token = issueToken(subject, ['superuser']);
    const profile = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(profile.body).toEqual(expect.objectContaining({ firstName }));
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getUser().identityProviderSubject).toBe(subject);
  });

  it('rejects missing, expired, wrong-issuer and wrong-audience tokens', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    for (const token of [
      issueToken(florianSubject, ['superuser'], { expiresIn: -1 }),
      issueToken(florianSubject, ['superuser'], { issuer: 'https://wrong.example/realms/myjudo' }),
      issueToken(florianSubject, ['superuser'], { audience: 'wrong-audience' }),
      'not-a-jwt',
    ]) {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
  });

  it('does not grant superuser access from a token role alone', async () => {
    const token = issueToken(memberSubject, ['superuser']);
    const profile = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(profile.body).toEqual(expect.objectContaining({ username: 'mitglied' }));
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${token}`)
      .send({ expiresInHours: 24 })
      .expect(403);
  });

  it('keeps invitation tokens hashed and revocable under Keycloak auth', async () => {
    const token = issueToken(florianSubject, ['superuser']);
    const invitation = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'invited@example.test', expiresInHours: 24 })
      .expect(201);
    const stored = await dataSource
      .getRepository(Invitation)
      .findOneByOrFail({ id: invitation.body.id as string });
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(invitation.body.token);
    await request(app.getHttpServer())
      .post(`/api/v1/invitations/${invitation.body.id}/revoke`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('provisions registrations as pending and accepts an invitation exactly once', async () => {
    const invitedEmail = 'invited-member@example.test';
    const pendingToken = issueToken(invitedSubject, [], {
      email: invitedEmail,
      username: 'eingeladen',
    });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${pendingToken}`)
      .expect(401);
    const pending = await dataSource
      .getRepository(User)
      .findOneByOrFail({ identityProviderSubject: invitedSubject });
    expect(pending.status).toBe(UserStatus.Pending);
    const invitation = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${issueToken(florianSubject, ['superuser'])}`)
      .send({ email: invitedEmail, expiresInHours: 24 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ token: invitation.body.token })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${pendingToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ token: invitation.body.token })
      .expect(409);
  });

  it('edits members with tenant isolation, validation, RBAC and audit', async () => {
    const adminToken = issueToken(florianSubject, ['superuser']);
    const memberToken = issueToken(memberSubject, []);
    const created = await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        memberNumber: `EDIT-${Date.now()}`,
        firstName: 'Vorher',
        lastName: 'Test',
      })
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
    const page = await request(app.getHttpServer())
      .get('/api/v1/members?search=Aktualisiert&page=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(page.body).toEqual(
      expect.objectContaining({
        total: 1,
        items: [expect.objectContaining({ id: created.body.id })],
      }),
    );
    expect(
      await dataSource.getRepository(AuditLog).countBy({
        entityId: created.body.id as string,
        action: 'member.updated',
      }),
    ).toBe(1);
    expect(await dataSource.getRepository(Member).findOneByOrFail({ id: created.body.id })).toEqual(
      expect.objectContaining({ firstName: 'Aktualisiert' }),
    );
    const foreignOrganization = await dataSource.getRepository(Organization).save({
      slug: `foreign-${Date.now()}`,
      name: 'Fremder Verein',
      timezone: 'Europe/Berlin',
      active: true,
    });
    const foreignUser = await dataSource.getRepository(User).save({
      organizationId: foreignOrganization.id,
      email: `foreign-${Date.now()}@example.test`,
      identityProviderSubject: '00000000-0000-0000-0000-000000000099',
      firstName: 'Fremd',
      lastName: 'Benutzer',
      status: UserStatus.Approved,
      approvedAt: new Date(),
      approvedBy: null,
    });
    const foreignMember = await dataSource.getRepository(Member).save({
      organizationId: foreignOrganization.id,
      userId: foreignUser.id,
      memberNumber: `FOREIGN-${Date.now()}`,
      firstName: 'Fremd',
      lastName: 'Mitglied',
      birthDate: null,
      status: MemberStatus.Active,
      exitDate: null,
      createdBy: foreignUser.id,
    });
    await request(app.getHttpServer())
      .get(`/api/v1/members/${foreignMember.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  async function ensureUser(
    organizationId: string,
    username: string,
    firstName: string,
    subject: string,
  ): Promise<User> {
    const repository = dataSource.getRepository(User);
    let user = await repository.findOneBy({ identityProviderSubject: subject });
    user ??= repository.create({
      organizationId,
      email: `${username}@example.test`,
      identityProviderSubject: subject,
      firstName,
      lastName: 'Test',
      status: UserStatus.Approved,
      approvedAt: new Date(),
      approvedBy: null,
    });
    user.firstName = firstName;
    return repository.save(user);
  }

  function issueToken(
    subject: string,
    roles: string[],
    overrides: {
      expiresIn?: number;
      issuer?: string;
      audience?: string;
      email?: string;
      username?: string;
    } = {},
  ): string {
    return sign(
      {
        realm_access: { roles },
        preferred_username: overrides.username ?? subject,
        email: overrides.email,
      },
      privateKey,
      {
        algorithm: 'RS256',
        keyid: keyId,
        subject,
        issuer: overrides.issuer ?? issuer,
        audience: overrides.audience ?? 'myjudo-api',
        expiresIn: overrides.expiresIn ?? 300,
      },
    );
  }
});
