import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { CalendarEvent } from './calendar-event.entity';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent]), RbacModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
