import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { ChatParticipant } from './chat-participant.entity';
import { ChatController } from './chat.controller';
import { Chat } from './chat.entity';
import { ChatService } from './chat.service';
import { Message } from './message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, ChatParticipant, Message]), RbacModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
