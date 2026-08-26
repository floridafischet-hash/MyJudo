import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { validateEnvironment } from './config/environment';
import { Organization } from './organizations/organization.entity';
import { User } from './users/user.entity';
import { Permission } from './rbac/permission.entity';
import { Role } from './rbac/role.entity';
import { UserRole } from './rbac/user-role.entity';
import { RolePermission } from './rbac/role-permission.entity';
import { AuditLog } from './audit/audit-log.entity';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from './users/users.module';
import { Member } from './members/member.entity';
import { MembersModule } from './members/members.module';
import { Invitation } from './invitations/invitation.entity';
import { InvitationsModule } from './invitations/invitations.module';
import { Chat } from './chat/chat.entity';
import { ChatParticipant } from './chat/chat-participant.entity';
import { Message } from './chat/message.entity';
import { ChatModule } from './chat/chat.module';
import { Session } from './auth/session.entity';
import { Group } from './training/group.entity';
import { UserGroup } from './training/user-group.entity';
import { TrainingSchedule } from './training/training-schedule.entity';
import { TrainingGroup } from './training/training-group.entity';
import { TrainingSession } from './training/training-session.entity';
import { Attendance } from './training/attendance.entity';
import { TrainingModule } from './training/training.module';
import { NotificationPreference } from './notifications/notification-preference.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatGroup } from './chat/chat-group.entity';
import { ProjectsModule } from './projects/projects.module';
import { Project } from './projects/project.entity';
import { DownloadsModule } from './downloads/downloads.module';
import { Download } from './downloads/download.entity';
import { DownloadFolder } from './downloads/download-category.entity';
import { DownloadGroup, DownloadRole, DownloadUser } from './downloads/download-access.entity';
import { ProjectMember } from './projects/project-member.entity';
import { ProjectCard } from './projects/project-card.entity';
import { ChecklistItem } from './projects/checklist-item.entity';
import { ProjectActivity } from './projects/project-activity.entity';
import { ProjectOrder } from './projects/project-order.entity';
import { ProjectFile } from './projects/project-file.entity';
import { MemberGraduation, MemberQualification } from './members/member-graduation.entity';
import { MemberImportJob } from './members/member-import-job.entity';
import { CalendarEvent } from './calendar/calendar-event.entity';
import { CalendarModule } from './calendar/calendar.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
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
          ProjectOrder,
          ProjectFile,
          MemberGraduation,
          MemberQualification,
          MemberImportJob,
          Download,
          DownloadFolder,
          DownloadGroup,
          DownloadRole,
          DownloadUser,
          CalendarEvent,
        ],
        synchronize: false,
        migrationsRun: false,
        logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
    AuthModule,
    RbacModule,
    UsersModule,
    MembersModule,
    InvitationsModule,
    ChatModule,
    TrainingModule,
    NotificationsModule,
    ProjectsModule,
    DownloadsModule,
    CalendarModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
