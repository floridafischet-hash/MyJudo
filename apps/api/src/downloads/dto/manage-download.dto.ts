import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DownloadCategory } from '../download.entity';
const array = (v: unknown) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return [];
    }
  }
  return [];
};
export class ManageDownloadDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsEnum(DownloadCategory) category!: DownloadCategory;
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  availableToAll!: boolean;
  @Transform(({ value }) => value === true || value === 'true') @IsBoolean() active!: boolean;
  @Transform(({ value }) => array(value))
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  groupIds!: string[];
  @Transform(({ value }) => array(value))
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds!: string[];
  @Transform(({ value }) => array(value))
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  userIds!: string[];
}
