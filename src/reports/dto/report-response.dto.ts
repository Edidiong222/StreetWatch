import { ReportStatus } from '../../common/enums/report-status.enum';
import { ReportImage } from '../entities/report-image.entity';
import { Report } from '../entities/report.entity';

export class ReportImageResponseDto {
  id!: string;
  url!: string;

  static fromEntity(image: ReportImage): ReportImageResponseDto {
    return {
      id: image.id,
      url: image.url,
    };
  }
}

export class ReportCategorySummaryDto {
  id!: string;
  name!: string;
  slug!: string;
}

export class ReportCreatorSummaryDto {
  id!: string;
  fullName!: string;
}

export class ReportResponseDto {
  id!: string;
  title!: string;
  description!: string;
  category!: ReportCategorySummaryDto;
  location!: string;
  latitude!: number | null;
  longitude!: number | null;
  creator!: ReportCreatorSummaryDto;
  status!: ReportStatus;
  verificationCount!: number;
  images!: ReportImageResponseDto[];
  hasVerified?: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(report: Report, hasVerified?: boolean): ReportResponseDto {
    const dto: ReportResponseDto = {
      id: report.id,
      title: report.title,
      description: report.description,
      category: {
        id: report.category.id,
        name: report.category.name,
        slug: report.category.slug,
      },
      location: report.location,
      latitude: report.latitude,
      longitude: report.longitude,
      creator: {
        id: report.creator.id,
        fullName: report.creator.fullName,
      },
      status: report.status,
      verificationCount: report.verificationCount,
      images: (report.images ?? []).map(ReportImageResponseDto.fromEntity),
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };

    if (hasVerified !== undefined) {
      dto.hasVerified = hasVerified;
    }

    return dto;
  }
}

export class PaginatedReportsResponseDto {
  data!: ReportResponseDto[];
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
