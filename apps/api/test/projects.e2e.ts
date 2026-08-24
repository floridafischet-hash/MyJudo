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
import { ProjectActivity } from '../src/projects/project-activity.entity';
import { AuditLog } from '../src/audit/audit-log.entity';

describe('Project completion and reopening', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organization: Organization;
  let adminToken: string;
  let outsiderToken: string;
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

    const adminUsername = `project-admin-${suffix}`;
    const admin = await dataSource.getRepository(User).save({
      organizationId: organization.id,
      email: `${adminUsername}@example.test`,
      username: adminUsername,
      passwordHash: await argon2.hash(`correct-password${pepper}`, { type: argon2.argon2id }),
      firstName: 'Projekt',
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
      .save({ userId: admin.id, roleId: superuser.id, assignedBy: admin.id });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: adminUsername, password: 'correct-password' })
      .expect(200);
    adminToken = adminLogin.body.accessToken as string;

    const outsiderUsername = `project-outsider-${suffix}`;
    const outsider = await dataSource.getRepository(User).save({
      organizationId: organization.id,
      email: `${outsiderUsername}@example.test`,
      username: outsiderUsername,
      passwordHash: await argon2.hash(`outsider-password${pepper}`, { type: argon2.argon2id }),
      firstName: 'Ohne',
      lastName: 'Zugriff',
      status: UserStatus.Approved,
      approvedAt: new Date(),
      approvedBy: null,
    });
    const memberRole = await dataSource
      .getRepository(Role)
      .findOneByOrFail({ organizationId: organization.id, name: 'Mitglied / Eltern' });
    await dataSource
      .getRepository(UserRole)
      .save({ userId: outsider.id, roleId: memberRole.id, assignedBy: admin.id });
    const outsiderLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: outsiderUsername, password: 'outsider-password' })
      .expect(200);
    outsiderToken = outsiderLogin.body.accessToken as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('moves a project into the completed view, keeps it reachable and reopenable, and logs every transition', async () => {
    const title = `Turniervorbereitung ${suffix}`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title, status: 'active', members: [] })
      .expect(201);
    const projectId = created.body.id as string;
    expect(created.body.completedAt).toBeNull();

    const activeList = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(activeList.body.some((p: { id: string }) => p.id === projectId)).toBe(true);

    // A user who is not a member and not a superuser must not reach the
    // project directly, even by guessing its id.
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    const completed = await request(app.getHttpServer())
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title, status: 'completed', members: [] })
      .expect(200);
    expect(completed.body.completedAt).not.toBeNull();

    const activeListAfterCompletion = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(activeListAfterCompletion.body.some((p: { id: string }) => p.id === projectId)).toBe(
      false,
    );

    const completedList = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .query({ status: 'completed' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const completedEntry = completedList.body.find((p: { id: string }) => p.id === projectId);
    expect(completedEntry).toMatchObject({ title, status: 'completed' });
    expect(completedEntry.completedAt).not.toBeNull();

    // A privileged user can still open the completed project directly.
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const completionActivity = await dataSource
      .getRepository(ProjectActivity)
      .findOneBy({ projectId, action: 'project.completed' });
    expect(completionActivity).not.toBeNull();
    const completionAudit = await dataSource
      .getRepository(AuditLog)
      .findOneBy({ entityId: projectId, action: 'project.completed' });
    expect(completionAudit?.metadata).toMatchObject({
      previousStatus: 'active',
      status: 'completed',
    });

    const reopened = await request(app.getHttpServer())
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title, status: 'active', members: [] })
      .expect(200);
    expect(reopened.body.completedAt).toBeNull();

    const activeListAfterReopen = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(activeListAfterReopen.body.some((p: { id: string }) => p.id === projectId)).toBe(true);

    const reopenActivity = await dataSource
      .getRepository(ProjectActivity)
      .findOneBy({ projectId, action: 'project.reopened' });
    expect(reopenActivity).not.toBeNull();
    const reopenAudit = await dataSource
      .getRepository(AuditLog)
      .findOneBy({ entityId: projectId, action: 'project.reopened' });
    expect(reopenAudit?.metadata).toMatchObject({
      previousStatus: 'completed',
      status: 'active',
    });
  });

  it('validates project images and protects upload and direct image URLs', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `Projektbilder ${suffix}`, status: 'active', members: [] })
      .expect(201);
    const projectId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/images`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'bild.jpg')
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('kein bild'), 'bild.jpg')
      .expect(400);

    const uploaded = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'Mannschaftsfoto')
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'bild.jpg')
      .expect(201);
    const cardId = uploaded.body.id as string;

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/images/${cardId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    const image = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/images/${cardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('Content-Type', /image\/jpeg/);
    expect(image.body).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  });
});
