import { IsDateString } from 'class-validator';

export class ListCalendarEventsDto {
  @IsDateString({ strict: true })
  from!: string;

  @IsDateString({ strict: true })
  to!: string;
}
