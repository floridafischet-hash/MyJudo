import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/)
  @Length(2, 100)
  username!: string;

  @IsString()
  @Length(1, 128)
  password!: string;
}
