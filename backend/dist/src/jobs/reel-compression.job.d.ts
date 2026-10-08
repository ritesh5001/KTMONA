/**
 * Reel Video Compression Job
 *
 * Processes uploaded reel videos using FFmpeg to generate:
 * - 720p variant for standard quality
 * - 480p variant for low-bandwidth connections
 * - Auto-generated thumbnail if not provided
 *
 * This job runs asynchronously after a reel is created.
 * It requires FFmpeg to be installed on the system.
 *
 * Usage:
 *   import { compressReelVideo } from './reel-compression.job.js';
 *   compressReelVideo(reelId, videoUrl).catch(err => logger.error(err));
 */
interface CompressionResult {
    reelId: string;
    success: boolean;
    durationSeconds?: number | undefined;
    error?: string | undefined;
}
/**
 * Queues a reel video for compression and metadata extraction.
 * This is a fire-and-forget operation — errors are logged but don't propagate.
 */
export declare function compressReelVideo(reelId: string, videoUrl: string): Promise<CompressionResult>;
export {};
//# sourceMappingURL=reel-compression.job.d.ts.map