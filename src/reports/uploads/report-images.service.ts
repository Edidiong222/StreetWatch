import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ReportImageResponseDto } from '../dto/report-response.dto';
import { ReportImage } from '../entities/report-image.entity';
import { ReportsService } from '../reports.service';
import { CloudinaryService, UploadedImage } from './cloudinary.service';

@Injectable()
export class ReportImagesService {
  constructor(
    @InjectRepository(ReportImage)
    private readonly imagesRepository: Repository<ReportImage>,
    private readonly reportsService: ReportsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async uploadImages(
    reportId: string,
    files: Express.Multer.File[],
    user: User,
  ): Promise<ReportImageResponseDto[]> {
    const report = await this.reportsService.ensureOwnerCanModifyReport(
      reportId,
      user,
    );

    const uploaded: UploadedImage[] = [];

    try {
      for (const file of files) {
        uploaded.push(await this.cloudinaryService.uploadImage(file));
      }

      const images = uploaded.map((image) =>
        this.imagesRepository.create({
          reportId: report.id,
          url: image.url,
          publicId: image.publicId,
        }),
      );

      const saved = await this.imagesRepository.save(images);

      return saved.map(ReportImageResponseDto.fromEntity);
    } catch (error) {
      await Promise.all(
        uploaded.map((image) =>
          this.cloudinaryService.deleteImage(image.publicId),
        ),
      );

      throw error;
    }
  }
}
