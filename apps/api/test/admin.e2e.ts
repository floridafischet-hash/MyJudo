import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AuditLog } from '../src/audit/audit-log.entity';
import { Organization } from '../src/organizations/organization.entity';
import { User } from '../src/users/user.entity';
import { UserStatus } from '../src/users/user-status.enum';
import { PasswordService } from '../src/auth/password.service';
import { MembershipLifecycleService } from '../src/members/membership-lifecycle.service';
import { Member } from '../src/members/member.entity';
import { MemberStatus } from '../src/members/member-status.enum';
import { UserRole } from '../src/rbac/user-role.entity';
import { Invitation } from '../src/invitations/invitation.entity';

describe('administrative user lifecycle', () => {
  jest.setTimeout(30_000);
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    adminToken = await login('admin@example.test', 'Temporary-Test-Only-2026!');
  });

  afterAll(async () => app.close());

  it('enforces approval, tenant scope, permissions, audit and token invalidation', async () => {
    const invitedEmail = `invited-${Date.now()}@example.test`;
    const invitation = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: invitedEmail, expiresInHours: 24 })
      .expect(201);
    expect(invitation.body.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const storedInvitation = await dataSource
      .getRepository(Invitation)
      .findOneByOrFail({ id: invitation.body.id as string });
    expect(storedInvitation.tokenHash).not.toBe(invitation.body.token);
    expect(storedInvitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const invitedRegistration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        organizationSlug: 'test-verein',
        email: invitedEmail,
        password: 'Invitation-Test-2026!',
        firstName: 'Eingeladen',
        lastName: 'Mitglied',
        invitationToken: invitation.body.token,
      })
      .expect(201);
    expect(invitedRegistration.body.status).toBe('approved');
    await login(invitedEmail, 'Invitation-Test-2026!');
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        organizationSlug: 'test-verein',
        email: `other-${Date.now()}@example.test`,
        password: 'Invitation-Test-2026!',
        firstName: 'Andere',
        lastName: 'Person',
        invitationToken: invitation.body.token,
      })
      .expect(409);
    const revokedInvitation = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/invitations/${revokedInvitation.body.id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        organizationSlug: 'test-verein',
        email: `revoked-${Date.now()}@example.test`,
        password: 'Invitation-Test-2026!',
        firstName: 'Widerrufen',
        lastName: 'Person',
        invitationToken: revokedInvitation.body.token,
      })
      .expect(409);

    const email = `pending-${Date.now()}@example.test`;
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        organizationSlug: 'test-verein',
        email,
        password: 'Registration-Test-2026!',
        firstName: 'Test',
        lastName: 'Mitglied',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: email.split('@')[0], password: 'Registration-Test-2026!' })
      .expect(401);
    const pending = await request(app.getHttpServer())
      .get('/api/v1/users?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pending.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: registration.body.id, email })]),
    );

    const foreignOrganization = await dataSource.getRepository(Organization).save({
      slug: `foreign-${Date.now()}`,
      name: 'Foreign',
      timezone: 'Europe/Berlin',
      active: true,
    });
    const passwordHash = await app.get(PasswordService).hash('Foreign-Test-2026!');
    const foreignUser = await dataSource.getRepository(User).save({
      organizationId: foreignOrganization.id,
      email: `foreign-${Date.now()}@example.test`,
      passwordHash,
      firstName: 'Foreign',
      lastName: 'User',
      status: UserStatus.Pending,
      approvedAt: null,
      approvedBy: null,
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${foreignUser.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${registration.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const firstMemberToken = await login(email, 'Registration-Test-2026!');
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${firstMemberToken}`)
      .expect(403);

    const roles = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const memberRole = roles.body.find(
      (role: { name: string }) => role.name === 'Mitglied / Eltern',
    );
    await request(app.getHttpServer())
      .put(`/api/v1/users/${registration.body.id}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleIds: [memberRole.id] })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${firstMemberToken}`)
      .expect(401);
    const refreshedMemberToken = await login(email, 'Registration-Test-2026!');
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${refreshedMemberToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${refreshedMemberToken}`)
      .send({ expiresInHours: 24 })
      .expect(403);

    const createdMember = await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        memberNumber: `M-${Date.now()}`,
        firstName: 'Test',
        lastName: 'Mitglied',
        userId: registration.body.id,
      })
      .expect(201);
    const csvExport = await request(app.getHttpServer())
      .get('/api/v1/members/export.csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /text\/csv/)
      .expect(200);
    expect(csvExport.text.startsWith('\uFEFF')).toBe(true);
    expect(csvExport.text).toContain('Mitgliedsnummer');
    expect(csvExport.text).toContain(createdMember.body.memberNumber as string);
    const xlsxExport = await request(app.getHttpServer())
      .get('/api/v1/members/export.xlsx')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect('Content-Type', /spreadsheetml/)
      .expect(200);
    expect(
      Buffer.from(xlsxExport.body as Uint8Array)
        .subarray(0, 2)
        .toString(),
    ).toBe('PK');
    await request(app.getHttpServer())
      .get('/api/v1/members/export.csv')
      .set('Authorization', `Bearer ${refreshedMemberToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${createdMember.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'exit_scheduled', exitDate: '2026-08-15' })
      .expect(200);
    const lifecycle = app.get(MembershipLifecycleService);
    await expect(lifecycle.process(new Date('2026-08-31T12:00:00Z'))).resolves.toBe(0);
    await expect(lifecycle.process(new Date('2026-09-01T12:00:00Z'))).resolves.toBe(1);
    await expect(lifecycle.process(new Date('2026-09-02T12:00:00Z'))).resolves.toBe(0);
    const endedMember = await dataSource
      .getRepository(Member)
      .findOneByOrFail({ id: createdMember.body.id });
    expect(endedMember.status).toBe(MemberStatus.Former);
    expect(
      await dataSource
        .getRepository(UserRole)
        .countBy({ userId: registration.body.id, roleId: memberRole.id }),
    ).toBe(0);
    await request(app.getHttpServer())
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${refreshedMemberToken}`)
      .expect(401);

    const audits = await dataSource
      .getRepository(AuditLog)
      .findBy({ entityId: registration.body.id });
    expect(audits.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['user.registered', 'user.approved', 'user.roles.replaced']),
    );
    const memberAudits = await dataSource
      .getRepository(AuditLog)
      .findBy({ entityId: createdMember.body.id });
    expect(memberAudits.filter((entry) => entry.action === 'member.exit.completed')).toHaveLength(
      1,
    );
    expect(
      await dataSource.getRepository(AuditLog).countBy({
        organizationId: endedMember.organizationId,
        action: 'members.exported',
      }),
    ).toBe(2);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: email.split('@')[0], password })
      .expect(200);
    return response.body.accessToken as string;
  }
});
