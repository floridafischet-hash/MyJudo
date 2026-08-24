import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CHAT_ICONS = ['group', 'forum', 'campaign', 'sports', 'school', 'shield'] as const;

export class ManageChatDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsString() @IsIn(CHAT_ICONS) icon!: string;
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) groupIds!: string[];
  @IsBoolean() archived!: boolean;
  @IsBoolean() active!: boolean;
}
