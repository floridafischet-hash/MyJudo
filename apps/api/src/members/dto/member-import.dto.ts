import { IsArray, IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum ImportDecisionAction {
  Create = 'create',
  Update = 'update',
  Skip = 'skip',
}
export class ImportDecisionDto {
  @IsUUID('4') rowId!: string;
  @IsEnum(ImportDecisionAction) action!: ImportDecisionAction;
  @IsOptional() @IsUUID('4') memberId?: string;
}
export class ConfirmMemberImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportDecisionDto)
  decisions!: ImportDecisionDto[];
}
