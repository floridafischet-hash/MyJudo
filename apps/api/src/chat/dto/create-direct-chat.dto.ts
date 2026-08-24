import { IsUUID } from 'class-validator';

export class CreateDirectChatDto {
  @IsUUID('4')
  participantUserId!: string;
}
