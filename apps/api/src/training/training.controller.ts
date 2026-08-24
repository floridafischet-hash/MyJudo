import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import {
  CreateGroupDto,
  CreateScheduleDto,
  CreateSessionDto,
  ListSessionsDto,
  ReplaceUserGroupsDto,
  SetScheduleActiveDto,
  SetSessionCancelledDto,
  UpdateSessionDto,
  VoteDto,
} from './dto/training.dto';
import { TrainingService } from './training.service';

interface TrainingRequest {
  user: AuthenticatedUser;
}

@Controller('training')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Get('sessions')
  @RequirePermissions('training.view')
  mySessions(@Req() req: TrainingRequest, @Query() query: ListSessionsDto) {
    return this.training.listMySessions(req.user, query.from, query.until);
  }
  @Put('sessions/:id/attendance')
  @RequirePermissions('attendance.vote')
  vote(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: VoteDto,
  ) {
    return this.training.vote(req.user, id, dto.status);
  }

  @Get('admin/groups')
  @RequirePermissions('training.manage')
  groups(@Req() req: TrainingRequest) {
    return this.training.listGroups(req.user);
  }
  @Post('admin/groups')
  @RequirePermissions('training.manage')
  createGroup(@Req() req: TrainingRequest, @Body() dto: CreateGroupDto) {
    return this.training.createGroup(req.user, dto);
  }
  @Put('admin/groups/:id')
  @RequirePermissions('training.manage')
  updateGroup(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.training.updateGroup(req.user, id, dto);
  }
  @Delete('admin/groups/:id')
  @HttpCode(204)
  @RequirePermissions('training.manage')
  deleteGroup(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.training.deleteGroup(req.user, id);
  }

  @Post('admin/groups/:id/avatar')
  @RequirePermissions('training.manage')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadGroupAvatar(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.training.uploadGroupAvatar(req.user, id, file);
  }
  @Delete('admin/groups/:id/avatar')
  @HttpCode(204)
  @RequirePermissions('training.manage')
  deleteGroupAvatar(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.training.deleteGroupAvatar(req.user, id);
  }
  @Get('groups/:id/avatar')
  async groupAvatar(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const image = await this.training.groupAvatar(req.user, id);
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(image.buffer);
  }

  @Get('admin/users')
  @RequirePermissions('training.manage')
  users(@Req() req: TrainingRequest) {
    return this.training.adminUsers(req.user);
  }
  @Put('admin/users/:id/groups')
  @RequirePermissions('training.manage')
  replaceGroups(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReplaceUserGroupsDto,
  ) {
    return this.training.replaceUserGroups(req.user, id, dto.groupIds);
  }

  @Get('admin/schedules')
  @RequirePermissions('training.manage')
  schedules(@Req() req: TrainingRequest) {
    return this.training.listSchedules(req.user);
  }
  @Post('admin/schedules')
  @RequirePermissions('training.manage')
  createSchedule(@Req() req: TrainingRequest, @Body() dto: CreateScheduleDto) {
    return this.training.createSchedule(req.user, dto);
  }
  @Put('admin/schedules/:id')
  @RequirePermissions('training.manage')
  updateSchedule(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.training.updateSchedule(req.user, id, dto);
  }
  @Patch('admin/schedules/:id/active')
  @RequirePermissions('training.manage')
  active(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetScheduleActiveDto,
  ) {
    return this.training.setScheduleActive(req.user, id, dto.active);
  }
  @Delete('admin/schedules/:id')
  @HttpCode(204)
  @RequirePermissions('training.manage')
  deleteSchedule(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.training.deleteSchedule(req.user, id);
  }
  @Get('admin/sessions/:id/attendance')
  @RequirePermissions('attendance.manage')
  attendance(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.training.attendanceList(req.user, id);
  }

  @Get('admin/sessions')
  @RequirePermissions('training.manage')
  adminSessions(@Req() req: TrainingRequest, @Query() query: ListSessionsDto) {
    return this.training.listAdminSessions(req.user, query.from, query.until);
  }
  @Post('admin/sessions')
  @RequirePermissions('training.manage')
  createSession(@Req() req: TrainingRequest, @Body() dto: CreateSessionDto) {
    return this.training.createSession(req.user, dto);
  }
  @Put('admin/sessions/:id')
  @RequirePermissions('training.manage')
  updateSession(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.training.updateSession(req.user, id, dto);
  }
  @Patch('admin/sessions/:id/cancelled')
  @RequirePermissions('training.manage')
  cancelSession(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetSessionCancelledDto,
  ) {
    return this.training.setSessionCancelled(req.user, id, dto.cancelled);
  }
  @Delete('admin/sessions/:id')
  @HttpCode(204)
  @RequirePermissions('training.manage')
  deleteSession(
    @Req() req: TrainingRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.training.deleteSession(req.user, id);
  }
}
