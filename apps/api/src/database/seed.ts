import 'reflect-metadata';
import dataSource from './data-source';
import { Organization } from '../organizations/organization.entity';
import { Permission } from '../rbac/permission.entity';
import { PERMISSIONS, STANDARD_ROLE_PERMISSIONS } from '../rbac/permission.catalog';
import { Role } from '../rbac/role.entity';
import { RolePermission } from '../rbac/role-permission.entity';

async function seed(): Promise<void> {
  const organizationSlug = required('INITIAL_ORGANIZATION_SLUG');
  const organizationName = required('INITIAL_ORGANIZATION_NAME');

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
  });
  await dataSource.destroy();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void seed();
