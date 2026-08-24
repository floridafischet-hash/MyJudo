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
import { ProjectOrder } from '../src/projects/project-order.entity';

describe('Per-user drag-and-drop project ordering', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organization: Organization;
  let adminToken: string;
  let memberAToken: string;
  let memberBToken: string;
  let memberAId: string;
  let memberBId: string;
  let alphaId: string;
  let betaId: string;
  let gammaId: string;
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

    const superuser = await dataSource
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
        lastName: 'Order',
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

    const admin = await createUser(`order-admin-${suffix}`, 'correct-password', 'Admin');
    await dataSource
      .getRepository(UserRole)
      .save({ userId: admin.id, roleId: superuser.id, assignedBy: admin.id });
    adminToken = await login(`order-admin-${suffix}`, 'correct-password');

    const memberA = await createUser(`order-member-a-${suffix}`, 'password-a', 'MemberA');
    memberAId = memberA.id;
    await dataSource
      .getRepository(UserRole)
      .save({ userId: memberA.id, roleId: memberRole.id, assignedBy: admin.id });
    memberAToken = await login(`order-member-a-${suffix}`, 'password-a');

    const memberB = await createUser(`order-member-b-${suffix}`, 'password-b', 'MemberB');
    memberBId = memberB.id;
    await dataSource
      .getRepository(UserRole)
      .save({ userId: memberB.id, roleId: memberRole.id, assignedBy: admin.id });
    memberBToken = await login(`order-member-b-${suffix}`, 'password-b');

    const create = async (title: string, memberIds: string[]) =>
      (
        await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title,
            status: 'active',
            members: memberIds.map((userId) => ({ userId, access: 'read' })),
          })
          .expect(201)
      ).body.id as string;

    alphaId = await create(`Alpha ${suffix}`, [memberA.id, memberB.id]);
    betaId = await create(`Beta ${suffix}`, [memberA.id, memberB.id]);
    gammaId = await create(`Gamma ${suffix} (no access)`, []);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('keeps drag-and-drop order private per user, persistent, permission-scoped, and correct across new/completed/reopened projects', async () => {
    const ids = async (token: string) =>
      (
        await request(app.getHttpServer())
          .get('/api/v1/projects')
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      ).body.map((p: { id: string }) => p.id) as string[];

    // Member B's default (never customized) order, captured before Member A
    // changes anything, so we can prove it stays untouched by A's change.
    const memberBBaseline = await ids(memberBToken);
    expect([...memberBBaseline].sort()).toEqual([alphaId, betaId].sort());

    // Member A reorders to Beta, Alpha.
    await request(app.getHttpServer())
      .put('/api/v1/projects/order')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({ order: [betaId, alphaId] })
      .expect(204);
    expect(await ids(memberAToken)).toEqual([betaId, alphaId]);

    // Member B's own view is unaffected by A's reorder.
    expect(await ids(memberBToken)).toEqual(memberBBaseline);

    // Member B sets the opposite order; persists independently of Member A.
    await request(app.getHttpServer())
      .put('/api/v1/projects/order')
      .set('Authorization', `Bearer ${memberBToken}`)
      .send({ order: [alphaId, betaId] })
      .expect(204);
    expect(await ids(memberBToken)).toEqual([alphaId, betaId]);
    // Re-checking Member A's order (persisted, independent of B's change).
    expect(await ids(memberAToken)).toEqual([betaId, alphaId]);

    // Member A cannot inject a project they have no access to; it is
    // silently dropped rather than stored or leaked.
    await request(app.getHttpServer())
      .put('/api/v1/projects/order')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({ order: [gammaId, alphaId, betaId] })
      .expect(204);
    expect(await ids(memberAToken)).toEqual([alphaId, betaId]);
    const gammaOrderRow = await dataSource
      .getRepository(ProjectOrder)
      .findOneBy({ userId: memberAId, projectId: gammaId });
    expect(gammaOrderRow).toBeNull();

    // Restore Member A's explicit order for the rest of the scenario.
    await request(app.getHttpServer())
      .put('/api/v1/projects/order')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({ order: [betaId, alphaId] })
      .expect(204);

    // A newly created project the user has access to is appended at the
    // end, not disrupting the existing custom order.
    const deltaId = (
      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Delta ${suffix}`,
          status: 'active',
          members: [{ userId: memberAId, access: 'read' }],
        })
        .expect(201)
    ).body.id as string;
    expect(await ids(memberAToken)).toEqual([betaId, alphaId, deltaId]);

    const betaMembers = [
      { userId: memberAId, access: 'read' },
      { userId: memberBId, access: 'read' },
    ];

    // Completing a project removes it from the active order without
    // disturbing the relative order of the remaining active projects.
    await request(app.getHttpServer())
      .put(`/api/v1/projects/${betaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `Beta ${suffix}`, status: 'completed', members: betaMembers })
      .expect(200);
    expect(await ids(memberAToken)).toEqual([alphaId, deltaId]);

    // Reopening it brings it back without duplicating or corrupting the list.
    await request(app.getHttpServer())
      .put(`/api/v1/projects/${betaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `Beta ${suffix}`, status: 'active', members: betaMembers })
      .expect(200);
    const afterReopen = await ids(memberAToken);
    expect(afterReopen).toHaveLength(3);
    expect(new Set(afterReopen)).toEqual(new Set([alphaId, deltaId, betaId]));

    // Resetting clears the custom order back to the default (matching
    // Member B's never-customized default, since both see the same set).
    await request(app.getHttpServer())
      .post('/api/v1/projects/order/reset')
      .set('Authorization', `Bearer ${memberAToken}`)
      .expect(204);
    const remainingOrderRows = await dataSource
      .getRepository(ProjectOrder)
      .findBy({ userId: memberAId });
    expect(remainingOrderRows).toHaveLength(0);
  });
});
