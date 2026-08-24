import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { Member } from './member.entity';
import { MembershipLifecycleService } from './membership-lifecycle.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberGraduation, MemberQualification } from './member-graduation.entity';
import { MemberImportJob } from './member-import-job.entity';
import { MemberImportController } from './member-import.controller';
import { MemberImportService } from './member-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Member, MemberGraduation, MemberQualification, MemberImportJob]),
    RbacModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MembersController, MemberImportController],
  providers: [MembersService, MembershipLifecycleService, MemberImportService],
  exports: [MembershipLifecycleService],
})
export class MembersModule {}
