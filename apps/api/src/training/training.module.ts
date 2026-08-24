import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { Attendance } from './attendance.entity';
import { Group } from './group.entity';
import { TrainingController } from './training.controller';
import { TrainingGroup } from './training-group.entity';
import { TrainingSchedule } from './training-schedule.entity';
import { TrainingService } from './training.service';
import { TrainingSession } from './training-session.entity';
import { UserGroup } from './user-group.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Group,
      UserGroup,
      TrainingSchedule,
      TrainingGroup,
      TrainingSession,
      Attendance,
    ]),
    RbacModule,
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
