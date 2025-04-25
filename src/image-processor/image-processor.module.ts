import { Module } from "@nestjs/common";
import { ImageProcessorController } from "./image-processor.controller";
import { ImageProcessorService } from "./image-processor.service";
import { LoggerModule } from "src/logger/logger.module";

@Module({
    imports: [LoggerModule],
    controllers: [ImageProcessorController],
    providers: [ImageProcessorService],
})
export class ImageProcessorModule {}

