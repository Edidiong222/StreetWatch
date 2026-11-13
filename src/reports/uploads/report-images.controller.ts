import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';
import { ReportImageResponseDto } from '../dto/report-response.dto';
import { ParseReportImagesPipe } from './parse-report-images.pipe';
import { ReportImagesService } from './report-images.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

@Controller('reports')
export class ReportImagesController {
  constructor(private readonly reportImagesService: ReportImagesService) {}

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', MAX_FILES, {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
      },
    }),
  )
  upload(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFiles(ParseReportImagesPipe) files: Express.Multer.File[],
    @CurrentUser() user: User,
  ): Promise<ReportImageResponseDto[]> {
    return this.reportImagesService.uploadImages(id, files, user);
  }
}
