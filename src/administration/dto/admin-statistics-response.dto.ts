import { ReportStatus } from '../../common/enums/report-status.enum';

export class ReportsByStatusDto {
  status!: ReportStatus;
  count!: number;
}

export class ReportsByCategoryDto {
  categoryId!: string;
  name!: string;
  count!: number;
}

export class RecentSubmissionDto {
  id!: string;
  title!: string;
  status!: ReportStatus;
  category!: {
    id: string;
    name: string;
  };
  creator!: {
    id: string;
    fullName: string;
  };
  createdAt!: Date;
}

export class AdminStatisticsResponseDto {
  totalReports!: number;
  pendingReports!: number;
  approvedReports!: number;
  inProgressReports!: number;
  resolvedReports!: number;
  rejectedReports!: number;
  reportsByStatus!: ReportsByStatusDto[];
  reportsByCategory!: ReportsByCategoryDto[];
  recentSubmissions!: RecentSubmissionDto[];
}
