import 'reflect-metadata';
import dataSource from './data-source';
import { Organization } from '../organizations/organization.entity';
import { Permission } from '../rbac/permission.entity';
import { PERMISSIONS, STANDARD_ROLE_PERMISSIONS } from '../rbac/permission.catalog';
import { Role } from '../rbac/role.entity';
import { RolePermission } from '../rbac/role-permission.entity';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { UserRole } from '../rbac/user-role.entity';

async function seed(): Promise<void> {
  const organizationSlug = required('INITIAL_ORGANIZATION_SLUG');
  const organizationName = required('INITIAL_ORGANIZATION_NAME');
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLocaleLowerCase('en-US');
  const adminSubject = process.env.INITIAL_ADMIN_KEYCLOAK_SUBJECT?.trim();

  await dataSource.initialize();
  await dataSource.transaction(async (manager) => {
    let organization = await manager
      .getRepository(Organization)
      .findOneBy({ slug: organizationSlug });
    organization ??= manager.getRepository(Organization).create({
      slug: organizationSlug,
      name: organizationName,
      timezone: 'Europe/Berlin',
      active: true,
    });
    organization = await manager.getRepository(Organization).save(organization);

    for (const key of PERMISSIONS) {
      await manager
        .getRepository(Permission)
        .upsert(
          { key, description: key },
          { conflictPaths: ['key'], skipUpdateIfNoValuesChanged: true },
        );
    }
    const permissions = await manager.getRepository(Permission).find();
    const permissionsByKey = new Map(permissions.map((permission) => [permission.key, permission]));

    const roleCatalog = {
      ...STANDARD_ROLE_PERMISSIONS,
      Superuser: PERMISSIONS.filter((permission) => permission !== 'chat.psg.access'),
    };
    const rolesByName = new Map<string, Role>();
    for (const [name, rolePermissions] of Object.entries(roleCatalog)) {
      let role = await manager
        .getRepository(Role)
        .findOneBy({ organizationId: organization.id, name });
      role ??= manager.getRepository(Role).create({
        organizationId: organization.id,
        name,
        description: name,
        system: true,
      });
      role = await manager.getRepository(Role).save(role);
      rolesByName.set(name, role);
      for (const key of rolePermissions) {
        const permission = permissionsByKey.get(key);
        if (!permission) throw new Error(`Permission not seeded: ${key}`);
        await manager
          .getRepository(RolePermission)
          .upsert(
            { roleId: role.id, permissionId: permission.id },
            { conflictPaths: ['roleId', 'permissionId'], skipUpdateIfNoValuesChanged: true },
          );
      }
    }

    if (!adminEmail || !adminSubject) return;
    let admin = await manager
      .getRepository(User)
      .findOneBy({ organizationId: organization.id, email: adminEmail });
    if (!admin) {
      admin = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          organizationId: organization.id,
          email: adminEmail,
          identityProviderSubject: adminSubject,
          firstName: 'Initial',
          lastName: 'Administrator',
          status: UserStatus.Approved,
          approvedAt: new Date(),
          approvedBy: null,
        }),
      );
      admin.approvedBy = admin.id;
      await manager.getRepository(User).save(admin);
    } else if (!admin.identityProviderSubject) {
      admin.identityProviderSubject = adminSubject;
      await manager.getRepository(User).save(admin);
    }
    const superuserRole = rolesByName.get('Superuser');
    if (!superuserRole) throw new Error('Superuser role was not seeded');
    await manager
      .getRepository(UserRole)
      .upsert(
        { userId: admin.id, roleId: superuserRole.id, assignedBy: admin.id },
        { conflictPaths: ['userId', 'roleId'], skipUpdateIfNoValuesChanged: true },
      );
  });
  await dataSource.destroy();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void seed();
