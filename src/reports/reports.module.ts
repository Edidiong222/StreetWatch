import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { ReportVerification } from '../verification/entities/report-verification.entity';
import { ReportImage } from './entities/report-image.entity';
import { Report } from './entities/report.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { CloudinaryService } from './uploads/cloudinary.service';
import { ReportImagesController } from './uploads/report-images.controller';
import { ReportImagesService } from './uploads/report-images.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportImage, ReportVerification]),
    CategoriesModule,
  ],
  controllers: [ReportsController, ReportImagesController],
  providers: [ReportsService, ReportImagesService, CloudinaryService],
  exports: [ReportsService],
})
export class ReportsModule {}
