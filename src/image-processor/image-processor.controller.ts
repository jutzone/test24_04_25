import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageProcessorService } from './image-processor.service';
import { LoggerService } from '../logger/logger.service';

@Controller('image')
export class ImageProcessorController {
  constructor(
    private readonly imageService: ImageProcessorService,
    private readonly logger: LoggerService,
  ) {}

  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  async processImage(@UploadedFile() file: Express.Multer.File) {
    this.logger.log('Image upload started');
    return this.imageService.processImage(file.buffer);
  }
}
