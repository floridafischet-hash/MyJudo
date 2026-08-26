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
const array = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed: unknown = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.length > 0 ? value : undefined,
  )
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
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
export class DownloadCategoryDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
}
export class MoveDownloadDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.length > 0 ? value : undefined,
  )
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}
