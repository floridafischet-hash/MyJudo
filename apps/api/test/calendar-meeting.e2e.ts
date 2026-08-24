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
import { Group } from '../src/training/group.entity';
import { UserGroup } from '../src/training/user-group.entity';
import { AuditLog } from '../src/audit/audit-log.entity';

describe('Calendar event online-meeting links', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organization: Organization;
  let adminToken: string;
  let insiderToken: string;
  let outsiderToken: string;
  let meetingGroupId: string;
  const pepper = 'test-password-pepper';
  const suffix = Date.now().toString(36);
  const from = '2026-09-01T00:00:00.000Z';
  const until = '2026-09-30T00:00:00.000Z';

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

    const superuserRole = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'Superuser' });
    const memberRole = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'Mitglied / Eltern' });

    const createUser = async (username: string, password: string, firstName: string) =>
      dataSource.getRepository(User).save({
        organizationId: organization.id,
        email: `${username}@example.test`,
        username,
        passwordHash: await argon2.hash(`${password}${pepper}`, { type: argon2.argon2id }),
        firstName,
        lastName: 'Meeting',
        status: UserStatus.Approved,
        approvedAt: new Date(),
        approvedBy: null,
      });
    const login = async (username: string, password: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username, password })
          .expect(200)
      ).body.accessToken as string;

    const admin = await createUser(`meeting-admin-${suffix}`, 'correct-password', 'Admin');
    await dataSource
      .getRepository(UserRole)
      .save({ userId: admin.id, roleId: superuserRole.id, assignedBy: admin.id });
    adminToken = await login(`meeting-admin-${suffix}`, 'correct-password');

    const insider = await createUser(`meeting-insider-${suffix}`, 'password-in', 'Insider');
    await dataSource
      .getRepository(UserRole)
      .save({ userId: insider.id, roleId: memberRole.id, assignedBy: admin.id });
    insiderToken = await login(`meeting-insider-${suffix}`, 'password-in');

    const outsider = await createUser(`meeting-outsider-${suffix}`, 'password-out', 'Outsider');
    await dataSource
      .getRepository(UserRole)
      .save({ userId: outsider.id, roleId: memberRole.id, assignedBy: admin.id });
    outsiderToken = await login(`meeting-outsider-${suffix}`, 'password-out');

    const group = await dataSource.getRepository(Group).save({
      organizationId: organization.id,
      name: `Meeting-Gruppe ${suffix}`,
    });
    await dataSource
      .getRepository(UserGroup)
      .save({ userId: insider.id, groupId: group.id, assignedBy: admin.id });
    meetingGroupId = group.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const baseEvent = () => ({
    title: `Vorstandssitzung ${suffix}`,
    startsAt: '2026-09-10T18:00:00.000Z',
    endsAt: '2026-09-10T19:00:00.000Z',
    groupIds: [meetingGroupId],
  });

  it('rejects a provider without a link', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/calendar/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...baseEvent(), meetingProvider: 'google_meet' })
      .expect(400);
  });

  it('rejects a link without a provider', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/calendar/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...baseEvent(), meetingUrl: 'https://meet.google.com/abc-defg-hij' })
      .expect(400);
  });

  it('rejects a non-https meeting link', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/calendar/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...baseEvent(),
        meetingProvider: 'google_meet',
        meetingUrl: 'http://meet.google.com/abc-defg-hij',
      })
      .expect(400);
  });

  it('rejects a link whose host does not match the selected provider', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/calendar/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...baseEvent(),
        meetingProvider: 'google_meet',
        meetingUrl: 'https://attacker.example/fake-meet',
      })
      .expect(400);
  });

  it('accepts a genuine Microsoft Teams (teams.live.com) link', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/calendar/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...baseEvent(),
        title: `Teams-Test ${suffix}`,
        meetingProvider: 'microsoft_teams',
        meetingUrl: 'https://teams.live.com/meet/123456',
      })
      .expect(201);
    expect(created.body.meetingProvider).toBe('microsoft_teams');
  });

  it('creates, shows only to authorized users, updates, logs without leaking the link, and can be cleared', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/calendar/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...baseEvent(),
        meetingProvider: 'google_meet',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        meetingNotes: 'Bitte 5 Minuten vorher beitreten.',
      })
      .expect(201);
    const eventId = created.body.id as string;
    expect(created.body.meetingProvider).toBe('google_meet');
    expect(created.body.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(created.body.meetingNotes).toBe('Bitte 5 Minuten vorher beitreten.');

    // An authorized (group member) user sees the event and its meeting link.
    const insiderList = await request(app.getHttpServer())
      .get('/api/v1/calendar/events')
      .query({ from, until })
      .set('Authorization', `Bearer ${insiderToken}`)
      .expect(200);
    const insiderEvent = insiderList.body.find((e: { id: string }) => e.id === eventId);
    expect(insiderEvent).toBeDefined();
    expect(insiderEvent.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');

    // An unauthorized user (not a group member, not a participant) does not
    // even see the event, let alone its meeting link.
    const outsiderList = await request(app.getHttpServer())
      .get('/api/v1/calendar/events')
      .query({ from, until })
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(200);
    expect(outsiderList.body.some((e: { id: string }) => e.id === eventId)).toBe(false);

    // Update to a Teams link; audit log captures the provider/change flag,
    // never the raw link or notes text.
    await request(app.getHttpServer())
      .put(`/api/v1/calendar/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...baseEvent(),
        meetingProvider: 'microsoft_teams',
        meetingUrl: 'https://teams.microsoft.com/l/meetup-join/xyz',
        meetingNotes: 'Zugangscode: 1234',
      })
      .expect(200);
    const updateAudit = await dataSource
      .getRepository(AuditLog)
      .findOneBy({ entityId: eventId, action: 'calendar.event.updated' });
    expect(updateAudit?.metadata).toMatchObject({
      meetingProvider: 'microsoft_teams',
      meetingChanged: true,
    });
    const metadataText = JSON.stringify(updateAudit?.metadata ?? {});
    expect(metadataText).not.toContain('teams.microsoft.com/l/meetup-join/xyz');
    expect(metadataText).not.toContain('1234');

    // Clearing the meeting (omitting both fields) removes it.
    await request(app.getHttpServer())
      .put(`/api/v1/calendar/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...baseEvent() })
      .expect(200);
    const afterClear = await request(app.getHttpServer())
      .get('/api/v1/calendar/events')
      .query({ from, until })
      .set('Authorization', `Bearer ${insiderToken}`)
      .expect(200);
    const clearedEvent = afterClear.body.find((e: { id: string }) => e.id === eventId);
    expect(clearedEvent.meetingProvider).toBeNull();
    expect(clearedEvent.meetingUrl).toBeNull();
  });
});
