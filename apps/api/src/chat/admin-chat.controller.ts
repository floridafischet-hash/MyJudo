import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  HttpCode,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { ChatService } from './chat.service';
import { ManageChatDto } from './dto/manage-chat.dto';

@Controller('chats/admin')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermissions('roles.manage')
export class AdminChatController {
  constructor(private readonly chats: ChatService) {}
  @Get() list(@Req() req: { user: AuthenticatedUser }) {
    return this.chats.listAdmin(req.user);
  }
  @Get('groups') groups(@Req() req: { user: AuthenticatedUser }) {
    return this.chats.listAdminGroups(req.user);
  }
  @Post() create(@Req() req: { user: AuthenticatedUser }, @Body() dto: ManageChatDto) {
    return this.chats.createManaged(req.user, dto);
  }
  @Put(':id') update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ManageChatDto,
  ) {
    return this.chats.updateManaged(req.user, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.chats.deleteManaged(req.user, id);
  }
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadAvatar(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.chats.uploadChatAvatar(req.user, id, file);
  }
  @Delete(':id/avatar') @HttpCode(204) deleteAvatar(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.chats.deleteChatAvatar(req.user, id);
  }
}
