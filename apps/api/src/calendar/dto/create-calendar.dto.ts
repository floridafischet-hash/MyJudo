import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CalendarType } from '../calendar.entity';

export class CreateCalendarDto {
  @IsEnum(CalendarType)
  type!: CalendarType;

  @IsString()
  @Length(1, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  requiredPermission?: string;
}
