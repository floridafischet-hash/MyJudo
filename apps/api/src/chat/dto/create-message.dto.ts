import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @Length(1, 4000)
  text!: string;

  @IsOptional()
  @IsUUID(4)
  replyToId?: string;
}
