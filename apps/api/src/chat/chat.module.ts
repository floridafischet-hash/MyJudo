import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { ChatParticipant } from './chat-participant.entity';
import { ChatController } from './chat.controller';
import { Chat } from './chat.entity';
import { ChatService } from './chat.service';
import { Message } from './message.entity';
import { ChatGroup } from './chat-group.entity';
import { AdminChatController } from './admin-chat.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, ChatParticipant, Message, ChatGroup]), RbacModule],
  controllers: [ChatController, AdminChatController],
  providers: [ChatService],
})
export class ChatModule {}
