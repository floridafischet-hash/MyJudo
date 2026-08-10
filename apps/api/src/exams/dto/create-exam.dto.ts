import { IsDateString, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateExamDto {
  @IsString() @Length(1, 180) title!: string;
  @IsDateString({ strict: true }) examDate!: string;
  @IsOptional() @IsString() @MaxLength(240) location?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
