import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListCalendarEventsDto {
  @IsDateString() from!: string;
  @IsDateString() until!: string;
}

export class SaveCalendarEventDto {
  @IsString() @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() @MaxLength(180) location?: string;
  @IsOptional() @IsString() @MaxLength(50) eventType?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) groupIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) participantIds?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(525600) reminderMinutes?: number;
  @IsOptional()
  @IsIn(['none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'])
  recurrence?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) recurrenceInterval?: number;
  @IsOptional() @IsDateString() recurrenceUntil?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) recurrenceCount?: number;
}

export class EventScopeDto {
  @IsOptional() @IsIn(['single', 'future', 'series']) scope?: 'single' | 'future' | 'series';
}
