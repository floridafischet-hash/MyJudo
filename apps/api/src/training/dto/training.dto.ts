import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsISO8601,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AttendanceStatus } from '../attendance.entity';

export class CreateGroupDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(120) minimumAge?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) maximumAge?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
}
export class UpdateGroupDto extends CreateGroupDto {}

export class ReplaceUserGroupsDto {
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) groupIds!: string[];
}

export class CreateScheduleDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(7) weekday!: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) groupIds!: string[];
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) validFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) validUntil?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateScheduleDto extends CreateScheduleDto {}

export class ListSessionsDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) until?: string;
}

export class VoteDto {
  @IsEnum(AttendanceStatus) status!: AttendanceStatus;
}

export class SetScheduleActiveDto {
  @IsBoolean() active!: boolean;
}
export class SetSessionCancelledDto {
  @IsBoolean() cancelled!: boolean;
}

export class CreateSessionDto {
  @IsUUID('4') trainingScheduleId!: string;
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsOptional() @IsBoolean() cancelled?: boolean;
}

export class UpdateSessionDto {
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsBoolean() cancelled!: boolean;
}
