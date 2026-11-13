import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReportStatus } from '../../common/enums/report-status.enum';

export const REPORT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'verificationCount',
] as const;

export type ReportSortField = (typeof REPORT_SORT_FIELDS)[number];

export const REPORT_SORT_ORDERS = ['ASC', 'DESC'] as const;

export type ReportSortOrder = (typeof REPORT_SORT_ORDERS)[number];

export class QueryReportsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(REPORT_SORT_FIELDS)
  sortBy: ReportSortField = 'createdAt';

  @IsOptional()
  @IsIn(REPORT_SORT_ORDERS)
  sortOrder: ReportSortOrder = 'DESC';
}
