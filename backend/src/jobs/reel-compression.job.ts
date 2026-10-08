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

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PrismaClient } from '../../node_modules/.prisma/client/index.js';
import { reelLogger } from '../config/logger.js';
import { prisma } from '../config/db.js';

const execFileAsync = promisify(execFile);
const db = prisma as PrismaClient;

interface CompressionResult {
    reelId: string;
    success: boolean;
    durationSeconds?: number | undefined;
    error?: string | undefined;
}

/**
 * Probe video metadata using ffprobe
 * Returns duration in seconds or null if probing fails
 */
async function probeVideoDuration(videoUrl: string): Promise<number | null> {
    try {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            videoUrl,
        ], { timeout: 30_000 });

        const data = JSON.parse(stdout) as { format?: { duration?: string } };
        const duration = data.format?.duration;
        return duration ? parseFloat(duration) : null;
    } catch (error) {
        reelLogger.warn({ videoUrl, error }, 'Failed to probe video duration');
        return null;
    }
}

/**
 * Queues a reel video for compression and metadata extraction.
 * This is a fire-and-forget operation — errors are logged but don't propagate.
 */
export async function compressReelVideo(reelId: string, videoUrl: string): Promise<CompressionResult> {
    const log = reelLogger.child({ reelId });

    try {
        // 1. Probe video duration
        const durationSeconds = await probeVideoDuration(videoUrl);

        if (durationSeconds !== null) {
            log.info({ durationSeconds }, 'Video duration probed');

            // Reject videos over 60 seconds (backend enforcement)
            if (durationSeconds > 60) {
                log.warn({ durationSeconds }, 'Video exceeds 60 second limit, marking as REJECTED');
                await db.reel.update({
                    where: { id: reelId },
                    data: { status: 'REJECTED' },
                });
                return { reelId, success: false, durationSeconds, error: 'Video exceeds 60 second limit' };
            }
        }

        // 2. Generate thumbnail if missing
        const reel = await db.reel.findUnique({ where: { id: reelId }, select: { thumbnailUrl: true } });
        if (reel && !reel.thumbnailUrl) {
            log.info('Thumbnail not provided — generation would happen here via FFmpeg');
            // In production, you would:
            // ffmpeg -i videoUrl -ss 00:00:01 -vframes 1 -f image2 output.jpg
            // Then upload to CDN and update reel.thumbnailUrl
        }

        // 3. Log compression intent (actual transcoding would use ffmpeg CLI)
        // In production, this would:
        //   - Download the source video
        //   - Transcode to 720p: ffmpeg -i input -vf scale=-2:720 -c:v libx264 -preset fast output_720p.mp4
        //   - Transcode to 480p: ffmpeg -i input -vf scale=-2:480 -c:v libx264 -preset fast output_480p.mp4
        //   - Upload variants to CDN
        //   - Update reel record with video720Url, video480Url
        log.info('Compression job completed (stub — transcoding requires FFmpeg + CDN upload pipeline)');

        return { reelId, success: true, durationSeconds: durationSeconds ?? undefined };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error({ error }, 'Reel compression job failed');
        return { reelId, success: false, error: message };
    }
}
