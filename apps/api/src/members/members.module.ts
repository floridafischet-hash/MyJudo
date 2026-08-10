import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { Member } from './member.entity';
import { MembershipLifecycleService } from './membership-lifecycle.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [TypeOrmModule.forFeature([Member]), RbacModule, ScheduleModule.forRoot()],
  controllers: [MembersController],
  providers: [MembersService, MembershipLifecycleService],
  exports: [MembershipLifecycleService],
})
export class MembersModule {}
