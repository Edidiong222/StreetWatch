import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';
import { VerificationResponseDto } from './dto/verification-response.dto';
import { VerificationService } from './verification.service';

@Controller('reports/:reportId/verifications')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  getCount(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
  ): Promise<VerificationResponseDto> {
    return this.verificationService.getCount(reportId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CITIZEN)
  verify(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @CurrentUser() user: User,
  ): Promise<VerificationResponseDto> {
    return this.verificationService.verify(reportId, user);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CITIZEN)
  unverify(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @CurrentUser() user: User,
  ): Promise<VerificationResponseDto> {
    return this.verificationService.unverify(reportId, user);
  }
}
