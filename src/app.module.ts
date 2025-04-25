import { Module } from "@nestjs/common";
import { ImageProcessorModule } from "./image-processor/image-processor.module";
import { LoggerModule } from "./logger/logger.module";

@Module({
    imports: [ImageProcessorModule, LoggerModule],
})
export class AppModule {}
