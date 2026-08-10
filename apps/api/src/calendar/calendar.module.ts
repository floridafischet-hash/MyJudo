import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { CalendarEvent } from './calendar-event.entity';
import { CalendarController } from './calendar.controller';
import { ClubCalendar } from './calendar.entity';
import { CalendarService } from './calendar.service';
import { TrainingSession } from './training-session.entity';
import { NjvCalendarSyncService } from './njv-calendar-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClubCalendar, CalendarEvent, TrainingSession]), RbacModule],
  controllers: [CalendarController],
  providers: [CalendarService, NjvCalendarSyncService],
  exports: [CalendarService],
})
export class CalendarModule {}
