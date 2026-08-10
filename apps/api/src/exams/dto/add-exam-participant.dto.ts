import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ExamParticipantStatus, GradeType } from '../exam-participant.entity';

export class AddExamParticipantDto {
  @IsUUID('4') memberId!: string;
  @IsEnum(GradeType) gradeType!: GradeType;
  @IsInt() @Min(1) @Max(10) grade!: number;
  @IsOptional() @IsEnum(ExamParticipantStatus) status?: ExamParticipantStatus;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
