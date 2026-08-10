import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import {
  CalendarEventSummary,
  CalendarService,
  CalendarSummary,
  TrainingSessionSummary,
} from './calendar.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { ListCalendarEventsDto } from './dto/list-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { UpdateTrainingSessionDto } from './dto/update-training-session.dto';
import { CalendarSyncResult, NjvCalendarSyncService } from './njv-calendar-sync.service';

interface CalendarRequest {
  user: AuthenticatedUser;
}

@Controller()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly njvSync: NjvCalendarSyncService,
  ) {}

  @Get('calendars')
  @RequirePermissions('calendar.view')
  listCalendars(@Req() request: CalendarRequest): Promise<CalendarSummary[]> {
    return this.calendar.listCalendars(request.user);
  }

  @Post('calendars')
  @RequirePermissions('calendar.create')
  createCalendar(
    @Req() request: CalendarRequest,
    @Body() dto: CreateCalendarDto,
  ): Promise<CalendarSummary> {
    return this.calendar.createCalendar(request.user, dto);
  }

  @Get('calendar-events')
  @RequirePermissions('calendar.view')
  listEvents(
    @Req() request: CalendarRequest,
    @Query() query: ListCalendarEventsDto,
  ): Promise<CalendarEventSummary[]> {
    return this.calendar.listEvents(request.user, query);
  }

  @Post('calendars/:id/events')
  @RequirePermissions('calendar.create')
  createEvent(
    @Req() request: CalendarRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateCalendarEventDto,
  ): Promise<CalendarEventSummary> {
    return this.calendar.createEvent(request.user, id, dto);
  }

  @Patch('calendar-events/:id')
  @RequirePermissions('calendar.edit')
  updateEvent(
    @Req() request: CalendarRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventSummary> {
    return this.calendar.updateEvent(request.user, id, dto);
  }

  @Get('training-sessions')
  @RequirePermissions('calendar.view')
  listTrainings(@Req() request: CalendarRequest): Promise<TrainingSessionSummary[]> {
    return this.calendar.listTrainings(request.user);
  }

  @Post('training-sessions')
  @RequirePermissions('calendar.create')
  createTraining(
    @Req() request: CalendarRequest,
    @Body() dto: CreateTrainingSessionDto,
  ): Promise<TrainingSessionSummary> {
    return this.calendar.createTraining(request.user, dto);
  }

  @Patch('training-sessions/:id')
  @RequirePermissions('calendar.edit')
  updateTraining(
    @Req() request: CalendarRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTrainingSessionDto,
  ): Promise<TrainingSessionSummary> {
    return this.calendar.updateTraining(request.user, id, dto);
  }

  @Post('calendar-sync/njv')
  @RequirePermissions('calendar.edit')
  syncNjv(@Req() request: CalendarRequest): Promise<CalendarSyncResult> {
    return this.njvSync.sync(request.user.organizationId, request.user.id);
  }
}
