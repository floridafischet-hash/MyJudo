import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationSettings, NotificationsService } from './notifications.service';

interface NotificationRequest {
  user: AuthenticatedUser;
}

@Controller('notifications/settings')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  get(@Req() request: NotificationRequest): Promise<NotificationSettings> {
    return this.notifications.get(request.user);
  }

  @Put()
  update(
    @Req() request: NotificationRequest,
    @Body() dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationSettings> {
    return this.notifications.update(request.user, dto);
  }
}
