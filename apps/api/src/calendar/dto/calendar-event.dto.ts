import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CalendarMeetingProvider } from '../calendar-event.entity';

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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.length > 0 ? value : undefined,
  )
  @IsOptional()
  @IsEnum(CalendarMeetingProvider)
  meetingProvider?: CalendarMeetingProvider;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined,
  )
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(2048)
  meetingUrl?: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingNotes?: string;
}

export class EventScopeDto {
  @IsOptional() @IsIn(['single', 'future', 'series']) scope?: 'single' | 'future' | 'series';
}
