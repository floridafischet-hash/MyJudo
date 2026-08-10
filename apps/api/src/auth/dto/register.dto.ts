import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Length(2, 80)
  organizationSlug!: string;

  @IsEmail()
  @Length(3, 320)
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;

  @IsString()
  @Length(1, 100)
  firstName!: string;

  @IsString()
  @Length(1, 100)
  lastName!: string;
}
