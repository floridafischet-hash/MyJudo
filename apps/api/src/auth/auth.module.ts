import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { Session } from './session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, Session, AuditLog]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtStrategy],
  exports: [PasswordService],
})
export class AuthModule {}
