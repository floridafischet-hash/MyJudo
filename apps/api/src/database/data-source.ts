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
import { Session } from '../auth/session.entity';
import { Group } from '../training/group.entity';
import { UserGroup } from '../training/user-group.entity';
import { TrainingSchedule } from '../training/training-schedule.entity';
import { TrainingGroup } from '../training/training-group.entity';
import { TrainingSession } from '../training/training-session.entity';
import { Attendance } from '../training/attendance.entity';
import { NotificationPreference } from '../notifications/notification-preference.entity';
import { ChatGroup } from '../chat/chat-group.entity';
import { Project } from '../projects/project.entity';
import { Download } from '../downloads/download.entity';
import { DownloadGroup, DownloadRole, DownloadUser } from '../downloads/download-access.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { ProjectCard } from '../projects/project-card.entity';
import { ChecklistItem } from '../projects/checklist-item.entity';
import { ProjectActivity } from '../projects/project-activity.entity';
import { MemberGraduation, MemberQualification } from '../members/member-graduation.entity';
import { MemberImportJob } from '../members/member-import-job.entity';
import { CalendarEvent } from '../calendar/calendar-event.entity';

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
    Session,
    Group,
    UserGroup,
    TrainingSchedule,
    TrainingGroup,
    TrainingSession,
    Attendance,
    NotificationPreference,
    ChatGroup,
    Project,
    ProjectMember,
    ProjectCard,
    ChecklistItem,
    ProjectActivity,
    MemberGraduation,
    MemberQualification,
    MemberImportJob,
    Download,
    DownloadGroup,
    DownloadRole,
    DownloadUser,
    CalendarEvent,
  ],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
});
