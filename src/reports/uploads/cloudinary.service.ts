import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface UploadedImage {
  url: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly folder: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    this.folder =
      this.configService.get<string>('CLOUDINARY_FOLDER') ??
      'streetwatch/reports';
    this.isConfigured = Boolean(cloudName && apiKey && apiSecret);

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadedImage> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Image uploads are not configured on this server',
      );
    }

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: this.folder,
            resource_type: 'image',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          },
          (error, response) => {
            if (error || !response) {
              reject(error ?? new Error('Cloudinary returned no response'));
              return;
            }

            resolve(response);
          },
        );

        stream.end(file.buffer);
      });

      if (!result.secure_url || !result.public_id) {
        throw new Error('Cloudinary response was missing required fields');
      }

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      this.logger.error(
        `Cloudinary upload failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadGatewayException('Image upload failed');
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (error) {
      this.logger.warn(
        `Failed to clean up Cloudinary asset ${publicId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
