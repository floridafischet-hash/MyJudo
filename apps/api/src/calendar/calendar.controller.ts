import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CalendarService } from './calendar.service';
import {
  EventScopeDto,
  ListCalendarEventsDto,
  SaveCalendarEventDto,
} from './dto/calendar-event.dto';
@Controller('calendar')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}
  @Get('activity') recent(@Req() r: { user: AuthenticatedUser }) {
    return this.calendar.recentActivity(r.user);
  }
  @Get('events') @RequirePermissions('training.view') list(
    @Req() r: { user: AuthenticatedUser },
    @Query() q: ListCalendarEventsDto,
  ) {
    return this.calendar.list(r.user, q.from, q.until);
  }
  @Post('events') @RequirePermissions('training.manage') create(
    @Req() r: { user: AuthenticatedUser },
    @Body() d: SaveCalendarEventDto,
  ) {
    return this.calendar.create(r.user, d);
  }
  @Put('events/:id') @RequirePermissions('training.manage') update(
    @Req() r: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: EventScopeDto,
    @Body() d: SaveCalendarEventDto,
  ) {
    return this.calendar.update(r.user, id, d, q.scope ?? 'single');
  }
  @Post('events/:id/copy') @RequirePermissions('training.manage') copy(
    @Req() r: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: SaveCalendarEventDto,
  ) {
    return this.calendar.copy(r.user, id, d);
  }
  @Delete('events/:id') @RequirePermissions('training.manage') remove(
    @Req() r: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: EventScopeDto,
  ) {
    return this.calendar.remove(r.user, id, q.scope ?? 'single');
  }
  @Get('events/:id/ics')
  @RequirePermissions('training.view')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="myjudo-termin.ics"')
  ics(@Req() r: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.calendar.ics(r.user, id);
  }
}
