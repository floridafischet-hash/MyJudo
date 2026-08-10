import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { RbacModule } from '../rbac/rbac.module';
import { PollOption } from './poll-option.entity';
import { PollVote } from './poll-vote.entity';
import { Poll } from './poll.entity';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';

@Module({
  imports: [TypeOrmModule.forFeature([Poll, PollOption, PollVote, AuditLog]), RbacModule],
  controllers: [PollsController],
  providers: [PollsService],
})
export class PollsModule {}
