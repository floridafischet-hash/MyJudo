import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { UserStatus } from '../user-status.enum';

export class CreateManagedUserDto {
  @IsString() @Length(1, 100) firstName!: string;
  @IsString() @Length(1, 100) lastName!: string;
  @IsString() @Length(3, 100) username!: string;
  @IsEmail() @Length(3, 320) email!: string;
  @IsString() @Length(1, 200) password!: string;
  @IsEnum(UserStatus) status!: UserStatus;
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) roleIds!: string[];
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) groupIds!: string[];
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
}

export class UpdateManagedUserDto extends CreateManagedUserDto {
  @IsOptional() @IsString() @Length(1, 200) declare password: string;
}
