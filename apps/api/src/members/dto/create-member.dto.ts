import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateMemberDto {
  @IsString() @Length(1, 80) memberNumber!: string;
  @IsString() @Length(1, 100) firstName!: string;
  @IsString() @Length(1, 100) lastName!: string;
  @IsOptional() @IsDateString({ strict: true }) birthDate?: string;
  @IsOptional() @IsUUID('4') userId?: string;
}
