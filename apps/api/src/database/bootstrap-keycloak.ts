import 'reflect-metadata';
import dataSource from './data-source';
import { AuditLog } from '../audit/audit-log.entity';
import { Organization } from '../organizations/organization.entity';
import { PERMISSIONS } from '../rbac/permission.catalog';
import { Permission } from '../rbac/permission.entity';
import { RolePermission } from '../rbac/role-permission.entity';
import { Role } from '../rbac/role.entity';
import { UserRole } from '../rbac/user-role.entity';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';

interface BootstrapUser {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

async function main(): Promise<void> {
  const keycloakUrl = required('KEYCLOAK_URL').replace(/\/$/, '');
  const realm = required('KEYCLOAK_REALM');
  const adminToken = await getAdminToken(keycloakUrl);
  const users: BootstrapUser[] = [
    {
      username: 'florian',
      email: 'florian@myjudo.local',
      firstName: 'Florian',
      lastName: 'Fischer',
      password: required('BOOTSTRAP_FLORIAN_PASSWORD'),
    },
    {
      username: 'stefan',
      email: 'stefan@myjudo.local',
      firstName: 'Stefan',
      lastName: 'Administrator',
      password: required('BOOTSTRAP_STEFAN_PASSWORD'),
    },
  ];
  const role = await keycloakJson<{ id: string; name: string }>(
    `${keycloakUrl}/admin/realms/${realm}/roles/superuser`,
    adminToken,
  );
  const subjects = new Map<string, string>();
  for (const user of users) {
    const subject = await ensureKeycloakUser(keycloakUrl, realm, adminToken, role, user);
    subjects.set(user.username, subject);
  }

  await dataSource.initialize();
  await dataSource.transaction(async (manager) => {
    const organization = await manager.getRepository(Organization).findOneByOrFail({
      slug: required('INITIAL_ORGANIZATION_SLUG'),
    });
    let superuser = await manager
      .getRepository(Role)
      .findOneBy({ organizationId: organization.id, name: 'Superuser' });
    superuser ??= await manager.getRepository(Role).save({
      organizationId: organization.id,
      name: 'Superuser',
      description: 'Administrative Vollrechte; PSG bleibt separat',
      system: true,
    });
    const permissionRows = await manager
      .getRepository(Permission)
      .findBy(PERMISSIONS.filter((key) => key !== 'chat.psg.access').map((key) => ({ key })));
    for (const permission of permissionRows) {
      await manager
        .getRepository(RolePermission)
        .upsert(
          { roleId: superuser.id, permissionId: permission.id },
          { conflictPaths: ['roleId', 'permissionId'], skipUpdateIfNoValuesChanged: true },
        );
    }
    for (const bootstrapUser of users) {
      const subject = subjects.get(bootstrapUser.username);
      if (!subject) throw new Error(`Keycloak subject missing: ${bootstrapUser.username}`);
      const matches = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .where('"user"."organizationId" = :organizationId', {
          organizationId: organization.id,
        })
        .andWhere('lower(split_part("user".email, \'@\', 1)) = :username', {
          username: bootstrapUser.username,
        })
        .getMany();
      let localUser = matches[0];
      if (matches.length > 1) {
        throw new Error(`Expected at most one local user for ${bootstrapUser.username}`);
      }
      localUser ??= await manager.getRepository(User).save({
        organizationId: organization.id,
        email: bootstrapUser.email,
        identityProviderSubject: subject,
        firstName: bootstrapUser.firstName,
        lastName: bootstrapUser.lastName,
        status: UserStatus.Approved,
        approvedAt: new Date(),
        approvedBy: null,
      });
      localUser.identityProviderSubject = subject;
      localUser.firstName = bootstrapUser.firstName;
      localUser.status = UserStatus.Approved;
      localUser.approvedAt ??= new Date();
      localUser.approvedBy ??= localUser.id;
      await manager.getRepository(User).save(localUser);
      await manager
        .getRepository(UserRole)
        .upsert(
          { userId: localUser.id, roleId: superuser.id, assignedBy: localUser.id },
          { conflictPaths: ['userId', 'roleId'], skipUpdateIfNoValuesChanged: true },
        );
      await manager.getRepository(AuditLog).save({
        organizationId: organization.id,
        actorUserId: localUser.id,
        action: 'identity.keycloak.linked',
        entityType: 'user',
        entityId: localUser.id,
        outcome: 'success',
        metadata: { username: bootstrapUser.username },
      });
    }
  });
  await dataSource.destroy();
}

async function getAdminToken(keycloakUrl: string): Promise<string> {
  const response = await fetch(`${keycloakUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: required('KEYCLOAK_ADMIN_USERNAME'),
      password: required('KEYCLOAK_ADMIN_PASSWORD'),
    }),
  });
  if (!response.ok) throw new Error(`Keycloak admin login failed: HTTP ${response.status}`);
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

async function ensureKeycloakUser(
  keycloakUrl: string,
  realm: string,
  token: string,
  role: { id: string; name: string },
  user: BootstrapUser,
): Promise<string> {
  const searchUrl = new URL(`${keycloakUrl}/admin/realms/${realm}/users`);
  searchUrl.searchParams.set('username', user.username);
  searchUrl.searchParams.set('exact', 'true');
  let matches = await keycloakJson<Array<{ id: string }>>(searchUrl.toString(), token);
  if (matches.length === 0) {
    await keycloakRequest(`${keycloakUrl}/admin/realms/${realm}/users`, token, 'POST', {
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: true,
      emailVerified: true,
    });
    matches = await keycloakJson<Array<{ id: string }>>(searchUrl.toString(), token);
  }
  if (matches.length !== 1) throw new Error(`Expected one Keycloak user: ${user.username}`);
  const subject = matches[0]?.id;
  if (!subject) throw new Error(`Keycloak subject missing after creation: ${user.username}`);
  await keycloakRequest(
    `${keycloakUrl}/admin/realms/${realm}/users/${subject}/reset-password`,
    token,
    'PUT',
    { type: 'password', value: user.password, temporary: false },
  );
  await keycloakRequest(
    `${keycloakUrl}/admin/realms/${realm}/users/${subject}/role-mappings/realm`,
    token,
    'POST',
    [role],
  );
  return subject;
}

async function keycloakJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Keycloak request failed: HTTP ${response.status}`);
  return (await response.json()) as T;
}

async function keycloakRequest(
  url: string,
  token: string,
  method: string,
  body: unknown,
): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Keycloak request failed: ${method} ${url} HTTP ${response.status}`);
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
