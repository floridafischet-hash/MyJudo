import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { ExamParticipant } from './exam-participant.entity';
import { Exam } from './exam.entity';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [TypeOrmModule.forFeature([Exam, ExamParticipant]), RbacModule],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
