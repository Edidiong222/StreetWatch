import { ReportStatus } from '../../common/enums/report-status.enum';
import { ReportStatusHistory } from '../entities/report-status-history.entity';

export class ReportStatusHistoryUserDto {
  id!: string;
  fullName!: string;
}

export class ReportStatusHistoryResponseDto {
  id!: string;
  reportId!: string;
  previousStatus!: ReportStatus;
  newStatus!: ReportStatus;
  changedBy!: ReportStatusHistoryUserDto;
  note!: string | null;
  createdAt!: Date;

  static fromEntity(
    history: ReportStatusHistory,
  ): ReportStatusHistoryResponseDto {
    return {
      id: history.id,
      reportId: history.reportId,
      previousStatus: history.previousStatus,
      newStatus: history.newStatus,
      changedBy: {
        id: history.changedBy.id,
        fullName: history.changedBy.fullName,
      },
      note: history.note,
      createdAt: history.createdAt,
    };
  }
}
