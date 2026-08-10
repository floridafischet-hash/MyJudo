import { IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateTrainingSessionDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startsAt!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endsAt!: string;

  @IsString()
  @Length(1, 160)
  hall!: string;

  @IsString()
  @Length(1, 240)
  location!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ageGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trainingGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  requiredPermission?: string;
}
