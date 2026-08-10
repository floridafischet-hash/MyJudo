import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { UserStatus } from './user-status.enum';
import { UsersService, UserSummary } from './users.service';
import { ListUserDirectoryDto } from './dto/list-user-directory.dto';
import { DirectoryUser } from './users.service';

interface UserRequest {
  user: AuthenticatedUser;
}

@Controller('users')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.approve')
  list(
    @Req() request: UserRequest,
    @Query('status', new DefaultValuePipe(UserStatus.Pending), new ParseEnumPipe(UserStatus))
    status: UserStatus,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<UserSummary[]> {
    return this.users.listByStatus(request.user, status, Math.min(Math.max(limit, 1), 100));
  }

  @Get('directory')
  @RequirePermissions('chat.general.access')
  directory(
    @Req() request: UserRequest,
    @Query() query: ListUserDirectoryDto,
  ): Promise<{ items: DirectoryUser[]; page: number; pageSize: number; total: number }> {
    return this.users.directory(request.user, query);
  }

  @Patch(':id/approve')
  @RequirePermissions('users.approve')
  approve(
    @Req() request: UserRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<UserSummary> {
    return this.users.approve(request.user, userId);
  }

  @Put(':id/roles')
  @RequirePermissions('roles.manage')
  assignRoles(
    @Req() request: UserRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: AssignRolesDto,
  ): Promise<{ userId: string; roleIds: string[] }> {
    return this.users.assignRoles(request.user, userId, dto.roleIds);
  }
}
