import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  memberNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;
}
