import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { Organization } from '../organizations/organization.entity';
import { Permission } from '../rbac/permission.entity';
import { RolePermission } from '../rbac/role-permission.entity';
import { Role } from '../rbac/role.entity';
import { UserRole } from '../rbac/user-role.entity';
import { User } from '../users/user.entity';
import { Member } from '../members/member.entity';
import { Invitation } from '../invitations/invitation.entity';
import { Chat } from '../chat/chat.entity';
import { ChatParticipant } from '../chat/chat-participant.entity';
import { Message } from '../chat/message.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    Organization,
    User,
    Permission,
    Role,
    UserRole,
    RolePermission,
    AuditLog,
    Member,
    Invitation,
    Chat,
    ChatParticipant,
    Message,
  ],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
});
