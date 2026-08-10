import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { PollType } from '../poll.entity';

export class CreatePollDto {
  @IsEnum(PollType)
  type!: PollType;

  @IsString()
  @Length(1, 180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsDateString({ strict: true })
  startsAt!: string;

  @IsDateString({ strict: true })
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  requiredPermission?: string;

  @IsBoolean()
  resultsVisibleToParticipants!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 160, { each: true })
  options?: string[];
}
