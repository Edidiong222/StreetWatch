import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import {
  PUBLIC_REPORT_STATUSES,
  ReportStatus,
} from '../common/enums/report-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { ReportVerification } from '../verification/entities/report-verification.entity';
import {
  PaginatedReportsResponseDto,
  ReportResponseDto,
} from './dto/report-response.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { ReportStatusHistoryResponseDto } from './dto/report-status-history-response.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportStatusHistory } from './entities/report-status-history.entity';
import { Report } from './entities/report.entity';

const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.PENDING_REVIEW]: [ReportStatus.APPROVED, ReportStatus.REJECTED],
  [ReportStatus.APPROVED]: [
    ReportStatus.IN_PROGRESS,
    ReportStatus.RESOLVED,
    ReportStatus.REJECTED,
  ],
  [ReportStatus.IN_PROGRESS]: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
  [ReportStatus.RESOLVED]: [],
  [ReportStatus.REJECTED]: [],
};

const EDITABLE_STATUSES = [ReportStatus.PENDING_REVIEW, ReportStatus.REJECTED];

const SORT_COLUMNS = {
  createdAt: 'report.createdAt',
  updatedAt: 'report.updatedAt',
  verificationCount: 'report.verificationCount',
} as const;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    @InjectRepository(ReportVerification)
    private readonly verificationsRepository: Repository<ReportVerification>,
    @InjectRepository(ReportStatusHistory)
    private readonly statusHistoryRepository: Repository<ReportStatusHistory>,
    private readonly categoriesService: CategoriesService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateReportDto, creator: User): Promise<ReportResponseDto> {
    this.assertCoordinatePair(dto.latitude, dto.longitude);
    await this.categoriesService.findActiveByIdOrFail(dto.categoryId);

    const duplicate = await this.reportsRepository
      .createQueryBuilder('report')
      .where('report.creator_id = :creatorId', { creatorId: creator.id })
      .andWhere('report.title = :title', { title: dto.title })
      .andWhere('report.location = :location', { location: dto.location })
      .andWhere('report.created_at > :since', {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .andWhere('report.status IN (:...statuses)', {
        statuses: [ReportStatus.PENDING_REVIEW, ReportStatus.APPROVED],
      })
      .getOne();

    if (duplicate) {
      throw new ConflictException(
        'A similar report was submitted recently. Please avoid duplicate reports.',
      );
    }

    const report = this.reportsRepository.create({
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId,
      location: dto.location,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      creatorId: creator.id,
      status: ReportStatus.PENDING_REVIEW,
      verificationCount: 0,
    });

    const saved = await this.reportsRepository.save(report);

    return this.toResponse(await this.loadReportOrFail(saved.id));
  }

  findPublic(query: QueryReportsDto): Promise<PaginatedReportsResponseDto> {
    const status = query.status ?? ReportStatus.APPROVED;

    if (!PUBLIC_REPORT_STATUSES.includes(status)) {
      throw new BadRequestException(
        'The public report listing only supports APPROVED, IN_PROGRESS or RESOLVED reports',
      );
    }

    const builder = this.createBaseQuery().andWhere('report.status = :status', {
      status,
    });

    return this.paginate(builder, query);
  }

  findMine(
    query: QueryReportsDto,
    creator: User,
  ): Promise<PaginatedReportsResponseDto> {
    const builder = this.createBaseQuery().andWhere(
      'report.creator_id = :creatorId',
      { creatorId: creator.id },
    );

    if (query.status) {
      builder.andWhere('report.status = :status', { status: query.status });
    }

    return this.paginate(builder, query);
  }

  findForAdmin(query: QueryReportsDto): Promise<PaginatedReportsResponseDto> {
    const builder = this.createBaseQuery();

    if (query.status) {
      builder.andWhere('report.status = :status', { status: query.status });
    }

    return this.paginate(builder, query);
  }

  findPending(query: QueryReportsDto): Promise<PaginatedReportsResponseDto> {
    return this.paginate(
      this.createBaseQuery().andWhere('report.status = :status', {
        status: ReportStatus.PENDING_REVIEW,
      }),
      query,
    );
  }

  async findPublicOrOwnOne(
    id: string,
    viewer?: User | null,
  ): Promise<ReportResponseDto> {
    const report = await this.findViewableReport(id, viewer);

    const hasVerified =
      viewer && report.status === ReportStatus.APPROVED
        ? await this.verificationsRepository.exists({
            where: { reportId: report.id, userId: viewer.id },
          })
        : false;

    return this.toResponse(report, hasVerified);
  }

  async findViewableReport(id: string, viewer?: User | null): Promise<Report> {
    const report = await this.loadReport(id);

    const isPublic = PUBLIC_REPORT_STATUSES.includes(report.status);
    const isOwner = viewer?.id === report.creatorId;
    const isAdmin =
      viewer?.role === UserRole.ADMIN || viewer?.role === UserRole.SUPER_ADMIN;

    if (!isPublic && !isOwner && !isAdmin) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async getStatusHistory(
    id: string,
    viewer?: User | null,
  ): Promise<ReportStatusHistoryResponseDto[]> {
    const report = await this.findViewableReport(id, viewer);

    const history = await this.statusHistoryRepository.find({
      where: { reportId: report.id },
      relations: { changedBy: true },
      order: { createdAt: 'ASC' },
    });

    return history.map(ReportStatusHistoryResponseDto.fromEntity);
  }

  async update(
    id: string,
    dto: UpdateReportDto,
    user: User,
  ): Promise<ReportResponseDto> {
    const report = await this.loadReport(id);

    if (report.creatorId !== user.id) {
      throw new ForbiddenException('You can only update your own reports');
    }

    if (!EDITABLE_STATUSES.includes(report.status)) {
      throw new BadRequestException(
        'Only reports that are pending review or rejected can be updated',
      );
    }

    if (dto.categoryId !== undefined) {
      await this.categoriesService.findActiveByIdOrFail(dto.categoryId);
      report.categoryId = dto.categoryId;
    }

    const nextLatitude =
      dto.latitude !== undefined ? dto.latitude : report.latitude;
    const nextLongitude =
      dto.longitude !== undefined ? dto.longitude : report.longitude;
    this.assertCoordinatePair(nextLatitude ?? undefined, nextLongitude ?? undefined);

    if (dto.title !== undefined) {
      report.title = dto.title;
    }

    if (dto.description !== undefined) {
      report.description = dto.description;
    }

    if (dto.location !== undefined) {
      report.location = dto.location;
    }

    report.latitude = nextLatitude;
    report.longitude = nextLongitude;

    if (report.status === ReportStatus.REJECTED) {
      report.status = ReportStatus.PENDING_REVIEW;
    }

    await this.reportsRepository.save(report);

    return this.toResponse(await this.loadReportOrFail(report.id));
  }

  async updateStatus(
    id: string,
    dto: UpdateReportStatusDto,
    administrator: User,
  ): Promise<ReportResponseDto> {
    const note = dto.note?.trim() ? dto.note.trim() : null;

    if (dto.status === ReportStatus.REJECTED && !note) {
      throw new BadRequestException('A reason is required when rejecting a report');
    }

    await this.dataSource.transaction(async (manager) => {
      const reports = manager.getRepository(Report);
      const report = await reports
        .createQueryBuilder('report')
        .setLock('pessimistic_write')
        .where('report.id = :id', { id })
        .getOne();

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      if (report.status === dto.status) {
        return;
      }

      const allowed = ALLOWED_STATUS_TRANSITIONS[report.status];

      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot change report status from ${report.status} to ${dto.status}`,
        );
      }

      const previousStatus = report.status;
      report.status = dto.status;
      await reports.save(report);

      await manager.getRepository(ReportStatusHistory).save(
        manager.getRepository(ReportStatusHistory).create({
          reportId: report.id,
          previousStatus,
          newStatus: dto.status,
          changedById: administrator.id,
          note,
        }),
      );

      if (report.creatorId !== administrator.id) {
        const notification = this.buildStatusNotification(
          report.title,
          dto.status,
          note,
        );

        await this.notificationsService.create(
          {
            userId: report.creatorId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            reportId: report.id,
          },
          manager,
        );
      }
    });

    return this.toResponse(await this.loadReportOrFail(id));
  }

  async ensureOwnerCanModifyReport(id: string, user: User): Promise<Report> {
    const report = await this.loadReport(id);

    if (report.creatorId !== user.id) {
      throw new ForbiddenException('You can only modify your own reports');
    }

    if (!EDITABLE_STATUSES.includes(report.status)) {
      throw new BadRequestException(
        'Images can only be added to reports that are pending review or rejected',
      );
    }

    return report;
  }

  private createBaseQuery(): SelectQueryBuilder<Report> {
    return this.reportsRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.category', 'category')
      .leftJoinAndSelect('report.creator', 'creator')
      .leftJoinAndSelect('report.images', 'images');
  }

  private async paginate(
    builder: SelectQueryBuilder<Report>,
    query: QueryReportsDto,
  ): Promise<PaginatedReportsResponseDto> {
    if (query.categoryId) {
      builder.andWhere('report.category_id = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.search) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('report.title ILIKE :search', { search: `%${query.search}%` })
            .orWhere('report.description ILIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('report.location ILIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    builder
      .orderBy(SORT_COLUMNS[query.sortBy], query.sortOrder)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [reports, total] = await builder.getManyAndCount();

    return {
      data: reports.map((report) => this.toResponse(report)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private async loadReport(id: string): Promise<Report> {
    const builder = this.reportsRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.category', 'category')
      .leftJoinAndSelect('report.creator', 'creator')
      .leftJoinAndSelect('report.images', 'images')
      .where('report.id = :id', { id })
      .addOrderBy('images.created_at', 'ASC');

    const report = await builder.getOne();

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  private async loadReportOrFail(id: string): Promise<Report> {
    return this.loadReport(id);
  }

  private toResponse(report: Report, hasVerified?: boolean): ReportResponseDto {
    return ReportResponseDto.fromEntity(report, hasVerified);
  }

  private buildStatusNotification(
    reportTitle: string,
    status: ReportStatus,
    note: string | null,
  ): { type: NotificationType; title: string; message: string } {
    const reason = note ? ` Reason: ${note.slice(0, 200)}` : '';

    switch (status) {
      case ReportStatus.APPROVED:
        return {
          type: NotificationType.REPORT_APPROVED,
          title: 'Report approved',
          message: `Your report "${reportTitle}" has been approved.`,
        };
      case ReportStatus.REJECTED:
        return {
          type: NotificationType.REPORT_REJECTED,
          title: 'Report rejected',
          message: `Your report "${reportTitle}" was rejected.${reason}`,
        };
      case ReportStatus.IN_PROGRESS:
        return {
          type: NotificationType.REPORT_STATUS_CHANGED,
          title: 'Report in progress',
          message: `Your report "${reportTitle}" is now in progress.${reason}`,
        };
      case ReportStatus.RESOLVED:
        return {
          type: NotificationType.REPORT_RESOLVED,
          title: 'Report resolved',
          message: `Your report "${reportTitle}" has been resolved.${reason}`,
        };
      default:
        return {
          type: NotificationType.REPORT_STATUS_CHANGED,
          title: 'Report status updated',
          message: `The status of your report "${reportTitle}" changed to ${status}.${reason}`,
        };
    }
  }

  private assertCoordinatePair(
    latitude?: number,
    longitude?: number,
  ): void {
    const hasLatitude = latitude !== undefined && latitude !== null;
    const hasLongitude = longitude !== undefined && longitude !== null;

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Latitude and longitude must be provided together',
      );
    }
  }
}
