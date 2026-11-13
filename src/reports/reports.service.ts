import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import {
  PUBLIC_REPORT_STATUSES,
  ReportStatus,
} from '../common/enums/report-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { ReportVerification } from '../verification/entities/report-verification.entity';
import {
  PaginatedReportsResponseDto,
  ReportResponseDto,
} from './dto/report-response.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { UpdateReportDto } from './dto/update-report.dto';
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
    private readonly categoriesService: CategoriesService,
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

  async findPublicOrOwnOne(
    id: string,
    viewer?: User | null,
  ): Promise<ReportResponseDto> {
    const report = await this.loadReport(id);

    const isPublic = PUBLIC_REPORT_STATUSES.includes(report.status);
    const isOwner = viewer?.id === report.creatorId;
    const isAdmin =
      viewer?.role === UserRole.ADMIN || viewer?.role === UserRole.SUPER_ADMIN;

    if (!isPublic && !isOwner && !isAdmin) {
      throw new NotFoundException('Report not found');
    }

    const hasVerified =
      viewer && report.status === ReportStatus.APPROVED
        ? await this.verificationsRepository.exists({
            where: { reportId: report.id, userId: viewer.id },
          })
        : false;

    return this.toResponse(report, hasVerified);
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
  ): Promise<ReportResponseDto> {
    const report = await this.loadReport(id);

    if (report.status === dto.status) {
      return this.toResponse(report);
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[report.status];

    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot change report status from ${report.status} to ${dto.status}`,
      );
    }

    report.status = dto.status;
    await this.reportsRepository.save(report);

    return this.toResponse(await this.loadReportOrFail(report.id));
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
