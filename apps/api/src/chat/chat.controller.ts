import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { ChatService, ChatSummary, MessageSummary } from './chat.service';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';

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

  @Post(':id/read')
  markRead(
    @Req() request: ChatRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ readAt: Date }> {
    return this.chats.markRead(request.user, id);
  }
}
