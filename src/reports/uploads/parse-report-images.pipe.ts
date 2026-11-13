import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

const ALLOWED_TYPES: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': (buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
  'image/webp': (buffer) =>
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP',
};

@Injectable()
export class ParseReportImagesPipe
  implements PipeTransform<Express.Multer.File[] | undefined, Express.Multer.File[]>
{
  transform(files: Express.Multer.File[] | undefined): Express.Multer.File[] {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }

    if (files.length > MAX_FILES) {
      throw new BadRequestException(`A maximum of ${MAX_FILES} images is allowed`);
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException('Each image must be 5 MB or smaller');
      }

      const validator = ALLOWED_TYPES[file.mimetype];

      if (!validator) {
        throw new BadRequestException(
          'Only JPEG, PNG or WebP images are allowed',
        );
      }

      if (!file.buffer || !validator(file.buffer)) {
        throw new BadRequestException(
          'The uploaded file content does not match a supported image type',
        );
      }
    }

    return files;
  }
}
