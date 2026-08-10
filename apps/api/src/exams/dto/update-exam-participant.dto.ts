import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ExamParticipantStatus, GradeType } from '../exam-participant.entity';

export class UpdateExamParticipantDto {
  @IsOptional() @IsEnum(GradeType) gradeType?: GradeType;
  @IsOptional() @IsInt() @Min(1) @Max(10) grade?: number;
  @IsOptional() @IsEnum(ExamParticipantStatus) status?: ExamParticipantStatus;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
