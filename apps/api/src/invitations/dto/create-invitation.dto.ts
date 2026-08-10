import { IsEmail, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateInvitationDto {
  @IsOptional()
  @IsEmail()
  @Length(3, 320)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  memberNumber?: string;

  @IsInt()
  @Min(1)
  @Max(720)
  expiresInHours!: number;
}
