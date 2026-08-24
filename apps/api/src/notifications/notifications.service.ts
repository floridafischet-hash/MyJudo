import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationPreference } from './notification-preference.entity';

export interface NotificationSettings {
  enabled: boolean;
  chatMessages: boolean;
  showMessagePreview: boolean;
}

const defaults: NotificationSettings = {
  enabled: false,
  chatMessages: true,
  showMessagePreview: false,
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
  ) {}

  async get(actor: AuthenticatedUser): Promise<NotificationSettings> {
    const preference = await this.preferences.findOneBy({
      userId: actor.id,
      organizationId: actor.organizationId,
    });
    return preference ? this.toSettings(preference) : { ...defaults };
  }

  async update(
    actor: AuthenticatedUser,
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationSettings> {
    let preference = await this.preferences.findOneBy({
      userId: actor.id,
      organizationId: actor.organizationId,
    });
    if (preference) {
      preference.enabled = dto.enabled;
      preference.chatMessages = dto.chatMessages;
      preference.showMessagePreview = dto.showMessagePreview;
    } else {
      preference = this.preferences.create({
        organizationId: actor.organizationId,
        userId: actor.id,
        ...dto,
      });
    }
    return this.toSettings(await this.preferences.save(preference));
  }

  private toSettings(preference: NotificationPreference): NotificationSettings {
    return {
      enabled: preference.enabled,
      chatMessages: preference.chatMessages,
      showMessagePreview: preference.showMessagePreview,
    };
  }
}
