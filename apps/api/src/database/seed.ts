import 'reflect-metadata';
import dataSource from './data-source';
import { Organization } from '../organizations/organization.entity';
import { Permission } from '../rbac/permission.entity';
import { PERMISSIONS, STANDARD_ROLE_PERMISSIONS } from '../rbac/permission.catalog';
import { Role } from '../rbac/role.entity';
import { RolePermission } from '../rbac/role-permission.entity';
import { Group } from '../training/group.entity';
import { TrainingSchedule } from '../training/training-schedule.entity';
import { TrainingGroup } from '../training/training-group.entity';

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

    const groupNames = ['Pandas', 'Axolotl', 'Wölfe', 'Gorillas', 'Silberrücken'];
    const groupsByName = new Map<string, Group>();
    for (const name of groupNames) {
      let group = await manager
        .getRepository(Group)
        .findOneBy({ organizationId: organization.id, name });
      group ??= manager.getRepository(Group).create({
        organizationId: organization.id,
        name,
        description: null,
        minimumAge: null,
        maximumAge: null,
        active: true,
      });
      groupsByName.set(name, await manager.getRepository(Group).save(group));
    }
    const scheduleCatalog = [
      {
        name: 'Kindertraining',
        weekday: 1,
        startTime: '16:15',
        endTime: '17:30',
        groups: ['Pandas', 'Axolotl', 'Wölfe'],
      },
      {
        name: 'Jugend- und Erwachsenentraining',
        weekday: 1,
        startTime: '17:30',
        endTime: '18:45',
        groups: ['Gorillas', 'Silberrücken'],
      },
      {
        name: 'Erwachsenentraining',
        weekday: 2,
        startTime: '19:00',
        endTime: '20:30',
        groups: ['Silberrücken'],
      },
      {
        name: 'Kindertraining',
        weekday: 5,
        startTime: '16:00',
        endTime: '17:15',
        groups: ['Pandas', 'Axolotl', 'Wölfe'],
      },
      {
        name: 'Jugend- und Erwachsenentraining',
        weekday: 5,
        startTime: '17:15',
        endTime: '18:30',
        groups: ['Gorillas', 'Silberrücken'],
      },
    ];
    for (const item of scheduleCatalog) {
      let schedule = await manager.getRepository(TrainingSchedule).findOneBy({
        organizationId: organization.id,
        weekday: item.weekday,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      schedule ??= manager.getRepository(TrainingSchedule).create({
        organizationId: organization.id,
        name: item.name,
        weekday: item.weekday,
        startTime: item.startTime,
        endTime: item.endTime,
        validFrom: null,
        validUntil: null,
        active: true,
      });
      schedule = await manager.getRepository(TrainingSchedule).save(schedule);
      for (const name of item.groups) {
        const group = groupsByName.get(name);
        if (!group) continue;
        await manager
          .getRepository(TrainingGroup)
          .upsert(
            { trainingScheduleId: schedule.id, groupId: group.id },
            { conflictPaths: ['trainingScheduleId', 'groupId'], skipUpdateIfNoValuesChanged: true },
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
