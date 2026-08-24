import { IsBoolean } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  chatMessages!: boolean;

  @IsBoolean()
  showMessagePreview!: boolean;
}
