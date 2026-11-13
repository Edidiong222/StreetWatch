import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ReportStatus } from '../common/enums/report-status.enum';
import { User } from '../users/entities/user.entity';
import { Report } from '../reports/entities/report.entity';
import { VerificationResponseDto } from './dto/verification-response.dto';
import { ReportVerification } from './entities/report-verification.entity';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(ReportVerification)
    private readonly verificationsRepository: Repository<ReportVerification>,
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    private readonly dataSource: DataSource,
  ) {}

  async verify(
    reportId: string,
    user: User,
  ): Promise<VerificationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const reports = manager.getRepository(Report);
      const verifications = manager.getRepository(ReportVerification);
      const report = await reports
        .createQueryBuilder('report')
        .setLock('pessimistic_write')
        .where('report.id = :reportId', { reportId })
        .getOne();

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      if (report.status !== ReportStatus.APPROVED) {
        throw new BadRequestException(
          'Only approved reports can be verified',
        );
      }

      if (report.creatorId === user.id) {
        throw new ForbiddenException('You cannot verify your own report');
      }

      const alreadyVerified = await verifications.exists({
        where: { reportId, userId: user.id },
      });

      if (alreadyVerified) {
        throw new ConflictException('You have already verified this report');
      }

      try {
        await verifications.insert({ reportId, userId: user.id });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException('You have already verified this report');
        }

        throw error;
      }

      await reports.increment({ id: reportId }, 'verificationCount', 1);

      const updated = await reports.findOneOrFail({ where: { id: reportId } });

      return {
        reportId,
        verificationCount: updated.verificationCount,
        verified: true,
      };
    });
  }

  async unverify(
    reportId: string,
    user: User,
  ): Promise<VerificationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const reports = manager.getRepository(Report);
      const verifications = manager.getRepository(ReportVerification);
      const report = await reports
        .createQueryBuilder('report')
        .setLock('pessimistic_write')
        .where('report.id = :reportId', { reportId })
        .getOne();

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      if (
        report.status !== ReportStatus.APPROVED &&
        report.status !== ReportStatus.IN_PROGRESS
      ) {
        throw new BadRequestException(
          'Verification can only be removed from approved or in-progress reports',
        );
      }

      const result = await verifications.delete({
        reportId,
        userId: user.id,
      });

      if (!result.affected) {
        throw new NotFoundException('You have not verified this report');
      }

      await reports
        .createQueryBuilder()
        .update(Report)
        .set({ verificationCount: () => 'GREATEST(verification_count - 1, 0)' })
        .where('id = :reportId', { reportId })
        .execute();

      const updated = await reports.findOneOrFail({ where: { id: reportId } });

      return {
        reportId,
        verificationCount: updated.verificationCount,
        verified: false,
      };
    });
  }

  async getCount(reportId: string): Promise<VerificationResponseDto> {
    const report = await this.reportsRepository.findOne({
      where: { id: reportId },
      select: ['id', 'verificationCount'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return {
      reportId: report.id,
      verificationCount: report.verificationCount,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } }).driverError
        ?.code === '23505'
    );
  }
}
