import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { PollsService, PollSummary } from './polls.service';

interface PollRequest {
  user: AuthenticatedUser;
}

@Controller('polls')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get()
  @RequirePermissions('polls.vote')
  list(@Req() request: PollRequest): Promise<PollSummary[]> {
    return this.polls.list(request.user);
  }

  @Get(':id')
  @RequirePermissions('polls.vote')
  find(
    @Req() request: PollRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PollSummary> {
    return this.polls.find(request.user, id);
  }

  @Post()
  @RequirePermissions('polls.create')
  create(@Req() request: PollRequest, @Body() dto: CreatePollDto): Promise<PollSummary> {
    return this.polls.create(request.user, dto);
  }

  @Post(':id/vote')
  @RequirePermissions('polls.vote')
  vote(
    @Req() request: PollRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CastVoteDto,
  ): Promise<PollSummary> {
    return this.polls.vote(request.user, id, dto);
  }
}
