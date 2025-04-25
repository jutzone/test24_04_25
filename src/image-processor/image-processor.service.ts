import { Injectable } from "@nestjs/common";
import sharp, { Sharp } from "sharp";
import { join } from "path";
import { ensureDir } from "fs-extra";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class ImageProcessorService {
    private readonly IMAGE_DIR = join(__dirname, "..", "..", "images");
    private readonly BLUR_OFFSET = 20;
    private readonly MIN_IMAGE_SIZE = 100;

    constructor(private readonly logger: LoggerService) {}

    async processImage(imageBuffer: Buffer) {
        try {
            await ensureDir(this.IMAGE_DIR);
            let image = sharp(imageBuffer);

            const { width: originalWidth, height: originalHeight } =
                await image.metadata();
            if (!originalWidth || !originalHeight) {
                throw new Error("Could not read image dimensions");
            }
            if (
                originalWidth < this.MIN_IMAGE_SIZE ||
                originalHeight < this.MIN_IMAGE_SIZE
            ) {
                throw new Error(
                    `Image too small. Minimum size: ${this.MIN_IMAGE_SIZE}x${this.MIN_IMAGE_SIZE}px`
                );
            }
            this.logger.log(`Starting image split ...`);
            const segments = await this.splitImageSafely(
                image,
                originalWidth,
                originalHeight
            );
            this.logger.log(`Image splitted into ${segments.length} parts`);

            await this.saveSegments(segments);
            this.logger.log(`Segments saved to ${this.IMAGE_DIR}`);

            const blurredSegments = await this.applySafeBlur(segments);
            this.logger.log(`Blur applied for all segments`);

            const result = await this.combineSegments(
                blurredSegments,
                originalWidth,
                originalHeight
            );
            const outputPath = join(this.IMAGE_DIR, "result.png");
            this.logger.log(
                `Segments combined. File saving to ${outputPath} ...`
            );
            const resultFile = await result.toFile(outputPath);
            this.logger.log(
                `File saved. Result file size is ${resultFile.size}.`
            );
            return { success: true, path: outputPath };
        } catch (error) {
            this.logger.error(`Processing failed: ${error.message}`);
            throw error;
        }
    }

    private async splitImageSafely(
        image: Sharp,
        width: number,
        height: number
    ): Promise<Sharp[]> {
        const halfWidth = Math.floor(width / 2);
        const halfHeight = Math.floor(height / 2);

        const imageBuffer = await image.toBuffer();

        return [
            // Top-left
            await this.safeExtract(imageBuffer, 0, 0, halfWidth, halfHeight),
            // Top-right
            await this.safeExtract(
                imageBuffer,
                halfWidth,
                0,
                width - halfWidth,
                halfHeight
            ),
            // Bottom-right
            await this.safeExtract(
                imageBuffer,
                halfWidth,
                halfHeight,
                width - halfWidth,
                height - halfHeight
            ),
            // Bottom-left
            await this.safeExtract(
                imageBuffer,
                0,
                halfHeight,
                halfWidth,
                height - halfHeight
            ),
        ];
    }

    private async safeExtract(
        buffer: Buffer,
        left: number,
        top: number,
        width: number,
        height: number
    ): Promise<Sharp> {
        return sharp(buffer).extract({ left, top, width, height });
    }

    private async applySafeBlur(segments: Sharp[]): Promise<Sharp[]> {
        const applyEdgeBlur = async (
            segment: Sharp,
            edges: ("left" | "right" | "top" | "bottom")[]
        ) => {
            let result = await segment.toBuffer();
            for (const edge of edges) {
                result = await this.applyEdgeBlurToBuffer(result, edge);
            }
            return sharp(result);
        };

        return Promise.all([
            applyEdgeBlur(segments[0], ["right", "bottom"]), // Top-left
            applyEdgeBlur(segments[1], ["left", "bottom"]), // Top-right
            applyEdgeBlur(segments[2], ["left", "top"]), // Bottom-right
            applyEdgeBlur(segments[3], ["right", "top"]), // Bottom-left
        ]);
    }

    private async applyEdgeBlurToBuffer(
        buffer: Buffer,
        edge: "left" | "right" | "top" | "bottom"
    ): Promise<Buffer> {
        const image = sharp(buffer);
        const { width, height } = await image.metadata();
        if (!width || !height) return buffer;

        const offset = Math.min(
            this.BLUR_OFFSET,
            edge === "left" || edge === "right" ? width / 3 : height / 3
        );

        let left = 0,
            top = 0,
            extractWidth = width,
            extractHeight = height;

        switch (edge) {
            case "left":
                extractWidth = offset;
                break;
            case "right":
                left = width - offset;
                extractWidth = offset;
                break;
            case "top":
                extractHeight = offset;
                break;
            case "bottom":
                top = height - offset;
                extractHeight = offset;
                break;
        }

        if (extractWidth <= 0 || extractHeight <= 0) return buffer;

        try {
            const blurredEdge = await sharp(buffer)
                .extract({
                    left,
                    top,
                    width: extractWidth,
                    height: extractHeight,
                })
                .blur(10)
                .toBuffer();

            return sharp(buffer)
                .composite([{ input: blurredEdge, left, top }])
                .toBuffer();
        } catch (error) {
            this.logger.warn(`Blur skipped for ${edge} edge`);
            return buffer;
        }
    }

    private async combineSegments(
        segments: Sharp[],
        totalWidth: number,
        totalHeight: number
    ): Promise<Sharp> {
        const halfWidth = Math.floor(totalWidth / 2);
        const halfHeight = Math.floor(totalHeight / 2);

        return sharp({
            create: {
                width: totalWidth,
                height: totalHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
        }).composite([
            { input: await segments[0].toBuffer(), left: 0, top: 0 },
            { input: await segments[1].toBuffer(), left: halfWidth, top: 0 },
            {
                input: await segments[2].toBuffer(),
                left: halfWidth,
                top: halfHeight,
            },
            { input: await segments[3].toBuffer(), left: 0, top: halfHeight },
        ]);
    }

    private async saveSegments(segments: Sharp[]): Promise<void> {
        await Promise.all([
            segments[0].toFile(join(this.IMAGE_DIR, "1.png")),
            segments[1].toFile(join(this.IMAGE_DIR, "2.png")),
            segments[2].toFile(join(this.IMAGE_DIR, "3.png")),
            segments[3].toFile(join(this.IMAGE_DIR, "4.png")),
        ]);
    }
}

