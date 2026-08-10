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
import { PollVote } from '../src/polls/poll-vote.entity';
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
  let unprivileged: User;
  let adminToken: string;
  let stefanToken: string;
  let memberToken: string;
  let unprivilegedToken: string;
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
    unprivileged = await createUser(`ohne-rolle-${suffix}`, 'Ohne Rolle', 'unused-password');
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
      [florian, stefan, member, unprivileged].map((user) =>
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
    unprivilegedToken = tokens[3]!;
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

  it('creates attendance polls, changes a vote and hides restricted results', async () => {
    const now = Date.now();
    const created = await request(app.getHttpServer())
      .post('/api/v1/polls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'attendance',
        title: 'Sommertraining',
        description: 'Teilnahme am Training',
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 3_600_000).toISOString(),
        resultsVisibleToParticipants: false,
      })
      .expect(201);
    expect(created.body.options.map((option: { label: string }) => option.label)).toEqual([
      'Ja',
      'Nein',
      'Vielleicht',
    ]);
    const yes = created.body.options[0].id as string;
    const no = created.body.options[1].id as string;
    const firstVote = await request(app.getHttpServer())
      .post(`/api/v1/polls/${created.body.id}/vote`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ optionId: yes })
      .expect(201);
    expect(firstVote.body).toEqual(
      expect.objectContaining({ selectedOptionId: yes, canViewResults: false, totalVotes: null }),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/polls/${created.body.id}/vote`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ optionId: no })
      .expect(201)
      .expect(({ body }) => expect(body.selectedOptionId).toBe(no));
    expect(
      await dataSource.getRepository(PollVote).countBy({
        pollId: created.body.id as string,
        userId: member.id,
      }),
    ).toBe(1);
    const result = await request(app.getHttpServer())
      .get(`/api/v1/polls/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(result.body.totalVotes).toBe(1);
    expect(result.body.options).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: no, voteCount: 1 })]),
    );
  });

  it('enforces poll windows, target permissions and a single vote under concurrency', async () => {
    const now = Date.now();
    await request(app.getHttpServer())
      .post('/api/v1/polls')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        type: 'attendance',
        title: 'Nicht erlaubt',
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 60_000).toISOString(),
        resultsVisibleToParticipants: false,
      })
      .expect(403);
    const restricted = await request(app.getHttpServer())
      .post('/api/v1/polls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'choice',
        title: 'Vorstandstermin',
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 3_600_000).toISOString(),
        requiredPermission: 'chat.board.access',
        resultsVisibleToParticipants: true,
        options: ['Montag', 'Dienstag'],
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/polls/${restricted.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(404);

    const open = await request(app.getHttpServer())
      .post('/api/v1/polls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'choice',
        title: 'Paralleltest',
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 3_600_000).toISOString(),
        resultsVisibleToParticipants: true,
        options: ['A', 'B'],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/polls/${open.body.id}/vote`)
      .set('Authorization', `Bearer ${unprivilegedToken}`)
      .send({ optionId: open.body.options[0].id })
      .expect(403);
    await Promise.all(
      open.body.options.map((option: { id: string }) =>
        request(app.getHttpServer())
          .post(`/api/v1/polls/${open.body.id}/vote`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ optionId: option.id })
          .expect(201),
      ),
    );
    expect(
      await dataSource.getRepository(PollVote).countBy({
        pollId: open.body.id as string,
        userId: member.id,
      }),
    ).toBe(1);

    const closed = await request(app.getHttpServer())
      .post('/api/v1/polls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'choice',
        title: 'Geschlossen',
        startsAt: new Date(now - 120_000).toISOString(),
        endsAt: new Date(now - 60_000).toISOString(),
        resultsVisibleToParticipants: true,
        options: ['A', 'B'],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/polls/${closed.body.id}/vote`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ optionId: closed.body.options[0].id })
      .expect(400);
  });

  it('isolates calendars by target permission and validates event ranges', async () => {
    const club = await request(app.getHttpServer())
      .post('/api/v1/calendars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'club', name: 'Vereinstermine' })
      .expect(201);
    const board = await request(app.getHttpServer())
      .post('/api/v1/calendars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'board', name: 'Vorstand intern', requiredPermission: 'chat.board.access' })
      .expect(201);
    const memberCalendars = await request(app.getHttpServer())
      .get('/api/v1/calendars')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(memberCalendars.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: club.body.id })]),
    );
    expect(memberCalendars.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: board.body.id })]),
    );
    await request(app.getHttpServer())
      .post('/api/v1/calendars')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ type: 'club', name: 'Nicht erlaubt' })
      .expect(403);

    const now = Date.now();
    const event = await request(app.getHttpServer())
      .post(`/api/v1/calendars/${club.body.id}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Vereinsfest',
        startsAt: new Date(now + 60_000).toISOString(),
        endsAt: new Date(now + 3_600_000).toISOString(),
        allDay: false,
        location: 'Dojo',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(
        `/api/v1/calendar-events?from=${encodeURIComponent(new Date(now).toISOString())}&to=${encodeURIComponent(new Date(now + 86_400_000).toISOString())}`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: event.body.id, title: 'Vereinsfest' }),
          ]),
        ),
      );
    await request(app.getHttpServer())
      .post(`/api/v1/calendars/${club.body.id}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Ungültig',
        startsAt: new Date(now + 3_600_000).toISOString(),
        endsAt: new Date(now + 60_000).toISOString(),
        allDay: false,
      })
      .expect(400);
  });

  it('provides permission-filtered recurring training times', async () => {
    const training = await request(app.getHttpServer())
      .post('/api/v1/training-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Kindertraining',
        weekday: 2,
        startsAt: '17:30',
        endsAt: '19:00',
        hall: 'Halle 1',
        location: 'Musterstraße 1',
        ageGroup: 'U13',
        trainingGroup: 'Kinder',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/training-sessions')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: training.body.id, weekday: 2 })]),
        ),
      );
    await request(app.getHttpServer())
      .post('/api/v1/training-sessions')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        name: 'Nicht erlaubt',
        weekday: 2,
        startsAt: '19:00',
        endsAt: '18:00',
        hall: 'Halle',
        location: 'Ort',
      })
      .expect(403);
  });

  it('manages belt exams with grade rules, exports, audit and negative RBAC', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/exams')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
    const candidate = await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        memberNumber: `EX-${suffix}`,
        firstName: 'Erika',
        lastName: 'Prüfling',
      })
      .expect(201);
    const exam = await request(app.getHttpServer())
      .post('/api/v1/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Sommerprüfung',
        examDate: '2026-08-22',
        location: 'Dojo',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/exams/${exam.body.id}/participants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId: candidate.body.id, gradeType: 'kyu', grade: 9 })
      .expect(400);
    const participant = await request(app.getHttpServer())
      .post(`/api/v1/exams/${exam.body.id}/participants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId: candidate.body.id, gradeType: 'kyu', grade: 5 })
      .expect(201);
    expect(participant.body).toEqual(
      expect.objectContaining({ memberName: 'Erika Prüfling', belt: '5. Kyu', status: 'planned' }),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/exams/${exam.body.id}/participants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId: candidate.body.id, gradeType: 'kyu', grade: 5 })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/exam-participants/${participant.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'passed' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/exam-participants/${participant.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'passed' })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('passed'));
    await request(app.getHttpServer())
      .patch('/api/v1/exam-participants/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'passed' })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/exams?page=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: exam.body.id,
              participants: expect.arrayContaining([
                expect.objectContaining({ id: participant.body.id, status: 'passed' }),
              ]),
            }),
          ]),
        ),
      );
    const csv = await request(app.getHttpServer())
      .get('/api/v1/exams/export.csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(csv.text).toContain('Erika');
    await request(app.getHttpServer())
      .get('/api/v1/exams/export.xlsx')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect('Content-Type', /spreadsheetml/);
    expect(
      await dataSource.getRepository(AuditLog).countBy({
        organizationId: organization.id,
        action: 'exams.exported',
      }),
    ).toBeGreaterThanOrEqual(2);
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
