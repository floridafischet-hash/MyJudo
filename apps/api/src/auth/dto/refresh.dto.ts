import { IsString, Length } from 'class-validator';

export class RefreshDto {
  @IsString()
  @Length(64, 256)
  refreshToken!: string;
}
