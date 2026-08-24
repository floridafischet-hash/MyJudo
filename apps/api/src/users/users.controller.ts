import {
  Body,
  Controller,
  Delete,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
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
import { AssignRolesDto } from './dto/assign-roles.dto';
import { UserStatus } from './user-status.enum';
import { UsersService, UserSummary } from './users.service';
import { ListUserDirectoryDto } from './dto/list-user-directory.dto';
import { DirectoryUser } from './users.service';
import { CreateManagedUserDto, UpdateManagedUserDto } from './dto/manage-user.dto';

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

  @Get('admin')
  @RequirePermissions('roles.manage')
  adminList(@Req() request: UserRequest) {
    return this.users.adminList(request.user);
  }

  @Post('admin')
  @RequirePermissions('roles.manage')
  create(@Req() request: UserRequest, @Body() dto: CreateManagedUserDto) {
    return this.users.createManaged(request.user, dto);
  }

  @Put('admin/:id')
  @RequirePermissions('roles.manage')
  update(
    @Req() request: UserRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.users.updateManaged(request.user, id, dto);
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

  @Post('admin/:id/avatar')
  @RequirePermissions('roles.manage')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadAvatar(
    @Req() request: UserRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.users.uploadAvatar(request.user, id, file);
  }

  @Delete('admin/:id/avatar')
  @HttpCode(204)
  @RequirePermissions('roles.manage')
  deleteAvatar(
    @Req() request: UserRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.users.deleteAvatar(request.user, id);
  }

  @Get(':id/avatar')
  async avatar(
    @Req() request: UserRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const image = await this.users.avatar(request.user, id);
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(image.buffer);
  }
}
