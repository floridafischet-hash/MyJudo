import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Length(2, 80)
  organizationSlug!: string;

  @IsEmail()
  @Length(3, 320)
  email!: string;

  @IsString()
  @Length(1, 128)
  password!: string;
}
