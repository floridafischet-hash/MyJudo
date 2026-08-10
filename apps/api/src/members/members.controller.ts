import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { Member } from './member.entity';
import { MembersService } from './members.service';
import type { Response } from 'express';
import { Res } from '@nestjs/common';

interface MemberRequest {
  user: AuthenticatedUser;
}

@Controller('members')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}
  @Get()
  @RequirePermissions('members.view')
  list(
    @Req() request: MemberRequest,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<Member[]> {
    return this.members.list(request.user, Math.min(Math.max(limit, 1), 100));
  }
  @Get('export.csv')
  @RequirePermissions('members.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@Req() request: MemberRequest, @Res() response: Response): Promise<void> {
    return this.members.exportCsv(request.user, response);
  }
  @Get('export.xlsx')
  @RequirePermissions('members.export')
  exportXlsx(@Req() request: MemberRequest, @Res() response: Response): Promise<void> {
    return this.members.exportXlsx(request.user, response);
  }
  @Post()
  @RequirePermissions('members.create')
  create(@Req() request: MemberRequest, @Body() dto: CreateMemberDto): Promise<Member> {
    return this.members.create(request.user, dto);
  }
  @Patch(':id/status')
  @RequirePermissions('members.status.change')
  updateStatus(
    @Req() request: MemberRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMemberStatusDto,
  ): Promise<Member> {
    return this.members.updateStatus(request.user, id, dto);
  }
}
