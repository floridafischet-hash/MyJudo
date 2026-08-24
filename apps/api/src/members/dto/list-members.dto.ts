import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { MemberStatus } from '../member-status.enum';

export enum MemberSortField {
  LastName = 'lastName',
  FirstName = 'firstName',
  MemberNumber = 'memberNumber',
  Status = 'status',
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export class ListMembersDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsEnum(MemberSortField)
  sortBy = MemberSortField.LastName;

  @IsOptional()
  @IsEnum(SortOrder)
  order = SortOrder.Asc;
}
