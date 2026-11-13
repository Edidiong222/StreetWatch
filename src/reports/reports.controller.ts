import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import {
  PaginatedReportsResponseDto,
  ReportResponseDto,
} from './dto/report-response.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: User,
  ): Promise<ReportResponseDto> {
    return this.reportsService.create(dto, user);
  }

  @Get()
  findPublic(
    @Query() query: QueryReportsDto,
  ): Promise<PaginatedReportsResponseDto> {
    return this.reportsService.findPublic(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(
    @Query() query: QueryReportsDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedReportsResponseDto> {
    return this.reportsService.findMine(query, user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: User | null,
  ): Promise<ReportResponseDto> {
    return this.reportsService.findPublicOrOwnOne(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: User,
  ): Promise<ReportResponseDto> {
    return this.reportsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateReportStatusDto,
  ): Promise<ReportResponseDto> {
    return this.reportsService.updateStatus(id, dto);
  }
}
