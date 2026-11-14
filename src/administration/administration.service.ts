import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportStatus } from '../common/enums/report-status.enum';
import {
  PaginatedReportsResponseDto,
  ReportResponseDto,
} from '../reports/dto/report-response.dto';
import { QueryReportsDto } from '../reports/dto/query-reports.dto';
import { Report } from '../reports/entities/report.entity';
import { ReportsService } from '../reports/reports.service';
import { User } from '../users/entities/user.entity';
import {
  AdminStatisticsResponseDto,
  RecentSubmissionDto,
  ReportsByCategoryDto,
  ReportsByStatusDto,
} from './dto/admin-statistics-response.dto';

interface StatusCountRow {
  status: ReportStatus;
  count: string | number;
}

interface CategoryCountRow {
  categoryId: string;
  name: string;
  count: string | number;
}

@Injectable()
export class AdministrationService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    private readonly reportsService: ReportsService,
  ) {}

  findReports(query: QueryReportsDto): Promise<PaginatedReportsResponseDto> {
    return this.reportsService.findForAdmin(query);
  }

  findPendingReports(
    query: QueryReportsDto,
  ): Promise<PaginatedReportsResponseDto> {
    return this.reportsService.findPending(query);
  }

  getStatistics(): Promise<AdminStatisticsResponseDto> {
    return this.buildStatistics();
  }

  private async buildStatistics(): Promise<AdminStatisticsResponseDto> {
    const [statusRows, categoryRows, recent] = await Promise.all([
      this.reportsRepository
        .createQueryBuilder('report')
        .select('report.status', 'status')
        .addSelect('COUNT(report.id)', 'count')
        .groupBy('report.status')
        .getRawMany<StatusCountRow>(),
      this.reportsRepository
        .createQueryBuilder('report')
        .innerJoin('report.category', 'category')
        .select('category.id', 'categoryId')
        .addSelect('category.name', 'name')
        .addSelect('COUNT(report.id)', 'count')
        .groupBy('category.id')
        .addGroupBy('category.name')
        .getRawMany<CategoryCountRow>(),
      this.reportsRepository.find({
        relations: { category: true, creator: true },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    const counts = new Map<ReportStatus, number>();
    for (const status of Object.values(ReportStatus)) {
      counts.set(status, 0);
    }
    for (const row of statusRows) {
      counts.set(row.status, Number(row.count));
    }

    const reportsByStatus: ReportsByStatusDto[] = Object.values(
      ReportStatus,
    ).map((status) => ({
      status,
      count: counts.get(status) ?? 0,
    }));

    const reportsByCategory: ReportsByCategoryDto[] = categoryRows
      .map((row) => ({
        categoryId: row.categoryId,
        name: row.name,
        count: Number(row.count),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const recentSubmissions: RecentSubmissionDto[] = recent.map((report) => ({
      id: report.id,
      title: report.title,
      status: report.status,
      category: {
        id: report.category.id,
        name: report.category.name,
      },
      creator: {
        id: report.creator.id,
        fullName: report.creator.fullName,
      },
      createdAt: report.createdAt,
    }));

    return {
      totalReports: reportsByStatus.reduce((sum, item) => sum + item.count, 0),
      pendingReports: counts.get(ReportStatus.PENDING_REVIEW) ?? 0,
      approvedReports: counts.get(ReportStatus.APPROVED) ?? 0,
      inProgressReports: counts.get(ReportStatus.IN_PROGRESS) ?? 0,
      resolvedReports: counts.get(ReportStatus.RESOLVED) ?? 0,
      rejectedReports: counts.get(ReportStatus.REJECTED) ?? 0,
      reportsByStatus,
      reportsByCategory,
      recentSubmissions,
    };
  }

  async approve(
    id: string,
    note: string | undefined,
    administrator: User,
  ): Promise<ReportResponseDto> {
    return this.changeStatus(id, ReportStatus.APPROVED, note, administrator);
  }

  async reject(
    id: string,
    reason: string,
    administrator: User,
  ): Promise<ReportResponseDto> {
    return this.changeStatus(
      id,
      ReportStatus.REJECTED,
      reason,
      administrator,
    );
  }

  async moveToInProgress(
    id: string,
    note: string | undefined,
    administrator: User,
  ): Promise<ReportResponseDto> {
    return this.changeStatus(
      id,
      ReportStatus.IN_PROGRESS,
      note,
      administrator,
    );
  }

  async resolve(
    id: string,
    note: string | undefined,
    administrator: User,
  ): Promise<ReportResponseDto> {
    return this.changeStatus(id, ReportStatus.RESOLVED, note, administrator);
  }

  private changeStatus(
    id: string,
    status: ReportStatus,
    note: string | undefined,
    administrator: User,
  ): Promise<ReportResponseDto> {
    return this.reportsService.updateStatus(
      id,
      { status, note },
      administrator,
    );
  }
}
