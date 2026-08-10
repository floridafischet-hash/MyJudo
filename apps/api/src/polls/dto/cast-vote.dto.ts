import { IsUUID } from 'class-validator';

export class CastVoteDto {
  @IsUUID('4')
  optionId!: string;
}
