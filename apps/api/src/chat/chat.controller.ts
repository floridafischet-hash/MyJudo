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
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { ChatService, ChatSummary, MessageSummary } from './chat.service';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import type { Response } from 'express';

interface ChatRequest {
  user: AuthenticatedUser;
}

@Controller('chats')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermissions('chat.general.access')
export class ChatController {
  constructor(private readonly chats: ChatService) {}

  @Get()
  list(@Req() request: ChatRequest): Promise<ChatSummary[]> {
    return this.chats.list(request.user);
  }

  @Post('direct')
  createDirect(
    @Req() request: ChatRequest,
    @Body() dto: CreateDirectChatDto,
  ): Promise<ChatSummary> {
    return this.chats.createDirect(request.user, dto);
  }

  @Get('unread')
  unread(@Req() request: ChatRequest) {
    return this.chats.unread(request.user);
  }

  @Get(':id/messages')
  listMessages(
    @Req() request: ChatRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ListMessagesDto,
  ): Promise<{ items: MessageSummary[]; nextBefore: string | null }> {
    return this.chats.listMessages(request.user, id, query);
  }

  @Post(':id/messages')
  send(
    @Req() request: ChatRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageSummary> {
    return this.chats.send(request.user, id, dto);
  }

  @Post(':id/images')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  sendImage(
    @Req() request: ChatRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('text') text: string,
    @Body('replyToId') replyToId: string | undefined,
  ) {
    return this.chats.sendImage(request.user, id, file, text, replyToId);
  }

  @Get(':id/messages/:messageId/image')
  async image(
    @Req() request: ChatRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Res() res: Response,
  ): Promise<void> {
    const image = await this.chats.image(request.user, id, messageId);
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(image.buffer);
  }

  @Patch(':id/messages/:messageId')
  editMessage(
    @Req() request: ChatRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body() dto: EditMessageDto,
  ): Promise<MessageSummary> {
    return this.chats.editMessage(request.user, id, messageId, dto);
  }

  @Post(':id/read')
  markRead(
    @Req() request: ChatRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MarkReadDto,
  ): Promise<{ readAt: Date }> {
    return this.chats.markRead(request.user, id, dto.messageId);
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(204)
  deleteMessage(
    @Req() request: ChatRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
  ): Promise<void> {
    return this.chats.deleteMessage(request.user, id, messageId);
  }
}
