import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class LoggerService {
    private readonly logger = new Logger("ImageProcessor");

    log(message: string) {
        this.logger.log(message);
    }

    error(message: string) {
        this.logger.error(message);
    }

    warn(message: string) {
        this.logger.warn(message);
    }

    debug(message: string) {
        this.logger.debug(message);
    }
}
