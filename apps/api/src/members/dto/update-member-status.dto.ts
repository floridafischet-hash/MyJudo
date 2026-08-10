import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { MemberStatus } from '../member-status.enum';

export class UpdateMemberStatusDto {
  @IsEnum(MemberStatus) status!: MemberStatus;
  @IsOptional() @IsDateString({ strict: true }) exitDate?: string;
}
