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
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
