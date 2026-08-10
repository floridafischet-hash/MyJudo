import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
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
