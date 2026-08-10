import 'reflect-metadata';
import * as argon2 from 'argon2';
import dataSource from './data-source';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { Role } from '../rbac/role.entity';
import { UserRole } from '../rbac/user-role.entity';
import { Chat, ChatType } from '../chat/chat.entity';
import { CalendarType, ClubCalendar } from '../calendar/calendar.entity';

const SYSTEM_CHATS = [
  ['general', 'Allgemein', 'chat.general.access'],
  ['board', 'Vorstand', 'chat.board.access'],
  ['clubwork', 'Vereinsarbeit', 'chat.clubwork.access'],
  ['trainer', 'Trainer', 'chat.trainer.access'],
  ['youth', 'Jugendtrainer', 'chat.youth.access'],
  ['psg', 'PSG / Kinderschutz', 'chat.psg.access'],
] as const;

const SYSTEM_CALENDARS = [
  ['club', 'Verein', CalendarType.Club, null],
  ['trainer', 'Trainer', CalendarType.Trainer, 'chat.trainer.access'],
  ['youth', 'Jugend', CalendarType.Youth, 'chat.youth.access'],
  ['board', 'Vorstand', CalendarType.Board, 'chat.board.access'],
  ['exams', 'Prüfungen', CalendarType.Exams, 'exams.view'],
  ['njv', 'NJV', CalendarType.Association, null],
] as const;

const USERS = [
  { username: 'florian', firstName: 'Florian', lastName: '', passwordVariable: 'FLORIAN_PASSWORD' },
  { username: 'stefan', firstName: 'Stefan', lastName: '', passwordVariable: 'STEFAN_PASSWORD' },
] as const;

async function bootstrap(): Promise<void> {
  const pepper = required('PASSWORD_PEPPER');
  await dataSource.initialize();
  await dataSource.transaction(async (manager) => {
    const organization = await manager.getRepository(Organization).findOneByOrFail({
      slug: required('INITIAL_ORGANIZATION_SLUG'),
      active: true,
    });
    const role = await manager.getRepository(Role).findOneByOrFail({
      organizationId: organization.id,
      name: 'Superuser',
    });
    let firstUser: User | null = null;
    for (const definition of USERS) {
      const email = `${definition.username}@myjudo.local`;
      let user = await manager
        .getRepository(User)
        .findOneBy({ organizationId: organization.id, email });
      if (!user) {
        user = manager.getRepository(User).create({
          organizationId: organization.id,
          email,
          firstName: definition.firstName,
          lastName: definition.lastName,
        });
      }
      user.passwordHash = await argon2.hash(`${required(definition.passwordVariable)}${pepper}`, {
        type: argon2.argon2id,
      });
      user.status = UserStatus.Approved;
      user.approvedAt ??= new Date();
      user = await manager.getRepository(User).save(user);
      user.approvedBy ??= user.id;
      await manager.getRepository(User).save(user);
      await manager
        .getRepository(UserRole)
        .upsert(
          { userId: user.id, roleId: role.id, assignedBy: user.id },
          { conflictPaths: ['userId', 'roleId'], skipUpdateIfNoValuesChanged: true },
        );
      firstUser ??= user;
    }
    if (!firstUser) throw new Error('No bootstrap user created');
    for (const [systemKey, title, requiredPermission] of SYSTEM_CHATS) {
      const existing = await manager
        .getRepository(Chat)
        .findOneBy({ organizationId: organization.id, systemKey });
      if (existing) continue;
      await manager.getRepository(Chat).save({
        organizationId: organization.id,
        type: ChatType.Group,
        title,
        requiredPermission,
        systemKey,
        directKey: null,
        createdBy: firstUser.id,
      });
    }
    for (const [systemKey, name, type, requiredPermission] of SYSTEM_CALENDARS) {
      const existing = await manager
        .getRepository(ClubCalendar)
        .findOneBy({ organizationId: organization.id, systemKey });
      if (existing) continue;
      await manager.getRepository(ClubCalendar).save({
        organizationId: organization.id,
        type,
        name,
        ownerUserId: null,
        requiredPermission,
        systemKey,
        createdBy: firstUser.id,
      });
    }
  });
  await dataSource.destroy();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void bootstrap();
