import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectAccess } from '../project-member.entity';
import { ProjectCardType } from '../project-card.entity';
import { ProjectStatus } from '../project.entity';
export class ProjectMemberDto {
  @IsUUID('4') userId!: string;
  @IsEnum(ProjectAccess) access!: ProjectAccess;
}
export class InitialChecklistDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(300, { each: true })
  items!: string[];
}
export class ListProjectsDto {
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}
export class ReorderProjectsDto {
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) order!: string[];
}
export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsEnum(ProjectStatus) status!: ProjectStatus;
  @IsArray() @ArrayUnique((entry: ProjectMemberDto) => entry.userId) members!: ProjectMemberDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialChecklistDto)
  initialChecklists?: InitialChecklistDto[];
}
export class UpdateProjectDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsEnum(ProjectStatus) status!: ProjectStatus;
  @IsArray() @ArrayUnique((entry: ProjectMemberDto) => entry.userId) members!: ProjectMemberDto[];
}
export class CreateCardDto {
  @IsEnum(ProjectCardType) type!: ProjectCardType;
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) content?: string;
}
export class UpdateCardDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) content?: string;
}
export class ChecklistItemDto {
  @IsString() @MinLength(1) @MaxLength(300) text!: string;
}
