import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  PaginatedReportsResponseDto,
  ReportResponseDto,
} from '../reports/dto/report-response.dto';
import { QueryReportsDto } from '../reports/dto/query-reports.dto';
import { ReportStatusHistoryResponseDto } from '../reports/dto/report-status-history-response.dto';
import { ReportsService } from '../reports/reports.service';
import { User } from '../users/entities/user.entity';
import { AdministrationService } from './administration.service';
import {
  RejectReportDto,
  StatusNoteDto,
} from './dto/admin-report-actions.dto';
import { AdminStatisticsResponseDto } from './dto/admin-statistics-response.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdministrationController {
  constructor(
    private readonly administrationService: AdministrationService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get('reports')
  findReports(
    @Query() query: QueryReportsDto,
  ): Promise<PaginatedReportsResponseDto> {
    return this.administrationService.findReports(query);
  }

  @Get('reports/pending')
  findPendingReports(
    @Query() query: QueryReportsDto,
  ): Promise<PaginatedReportsResponseDto> {
    return this.administrationService.findPendingReports(query);
  }

  @Get('reports/:id/history')
  getHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ): Promise<ReportStatusHistoryResponseDto[]> {
    return this.reportsService.getStatusHistory(id, user);
  }

  @Get('statistics')
  getStatistics(): Promise<AdminStatisticsResponseDto> {
    return this.administrationService.getStatistics();
  }

  @Patch('reports/:id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: StatusNoteDto,
    @CurrentUser() user: User,
  ): Promise<ReportResponseDto> {
    return this.administrationService.approve(id, dto.note, user);
  }

  @Patch('reports/:id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectReportDto,
    @CurrentUser() user: User,
  ): Promise<ReportResponseDto> {
    return this.administrationService.reject(id, dto.reason, user);
  }

  @Patch('reports/:id/in-progress')
  moveToInProgress(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: StatusNoteDto,
    @CurrentUser() user: User,
  ): Promise<ReportResponseDto> {
    return this.administrationService.moveToInProgress(id, dto.note, user);
  }

  @Patch('reports/:id/resolve')
  resolve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: StatusNoteDto,
    @CurrentUser() user: User,
  ): Promise<ReportResponseDto> {
    return this.administrationService.resolve(id, dto.note, user);
  }
}
