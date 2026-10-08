import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../errors/ApiError.js';
import { productService } from './product.service.js';
import type { CreateTryOnInput } from '../validators/tryOn.validation.js';

const FASHN_BASE_URL = 'https://api.fashn.ai/v1';

type FashnRunResponse = {
    id?: string;
    error?: unknown;
    message?: string;
};

type FashnStatusResponse = {
    id: string;
    status: 'starting' | 'in_queue' | 'processing' | 'completed' | 'failed';
    output?: string[];
    error?: { name?: string; message?: string } | string | null;
};

export type TryOnResponse = {
    predictionId: string;
    status: 'completed';
    productImage: string;
    output: string[];
};

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstValidImage(images?: string[] | null): string | null {
    return images?.find((image) => typeof image === 'string' && image.trim().length > 0)?.trim() ?? null;
}

function isPublicImageReference(value: string): boolean {
    return /^https?:\/\//i.test(value) || /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value);
}

function formatFashnError(error: unknown): string {
    if (!error) return 'FASHN request failed';
    if (typeof error === 'string') return error;
    if (typeof error === 'object') {
        const maybe = error as { name?: string; message?: string };
        return [maybe.name, maybe.message].filter(Boolean).join(': ') || JSON.stringify(error);
    }
    return String(error);
}

export class FashnTryOnService {
    private get apiKey(): string {
        if (!env.FASHN_API_KEY) {
            throw new ApiError(503, 'Virtual try-on is not configured');
        }
        return env.FASHN_API_KEY;
    }

    async createTryOn(input: CreateTryOnInput): Promise<TryOnResponse> {
        const { product } = await productService.getProductById(input.productId);
        const variant = input.variantId
            ? product.variants.find((item) => item.id === input.variantId)
            : product.variants[0];

        if (input.variantId && !variant) {
            throw ApiError.notFound('Product variant not found');
        }

        const productImage =
            firstValidImage(variant?.images) ??
            firstValidImage(product.images);

        if (!productImage || !isPublicImageReference(productImage)) {
            throw ApiError.badRequest('This product does not have a public image for virtual try-on');
        }

        const predictionInput: {
            userImage: string;
            productImage: string;
            prompt?: string;
        } = {
            userImage: input.userImage,
            productImage,
        };
        if (input.prompt) {
            predictionInput.prompt = input.prompt;
        }

        const predictionId = await this.startPrediction(predictionInput);
        const completed = await this.pollPrediction(predictionId);

        if (!completed.output?.length) {
            throw new ApiError(502, 'Virtual try-on completed without an output image');
        }

        return {
            predictionId,
            status: 'completed',
            productImage,
            output: completed.output,
        };
    }

    private async startPrediction(params: {
        userImage: string;
        productImage: string;
        prompt?: string;
    }): Promise<string> {
        const isTryOnMax = env.FASHN_TRYON_MODEL === 'tryon-max';
        const inputs = isTryOnMax
            ? {
                product_image: params.productImage,
                model_image: params.userImage,
                prompt: params.prompt ?? 'realistic ecommerce virtual try-on, preserve identity and pose',
                resolution: '1k',
                generation_mode: 'balanced',
                num_images: 1,
                output_format: 'jpeg',
            }
            : {
                garment_image: params.productImage,
                model_image: params.userImage,
                category: 'auto',
                garment_photo_type: 'auto',
                mode: 'balanced',
                num_samples: 1,
                output_format: 'jpeg',
            };

        const response = await fetch(`${FASHN_BASE_URL}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model_name: env.FASHN_TRYON_MODEL,
                inputs,
            }),
        });

        const body = (await response.json().catch(() => null)) as FashnRunResponse | null;

        if (!response.ok || !body?.id) {
            logger.warn({ status: response.status, body }, 'FASHN try-on run failed');
            throw new ApiError(502, body?.message ?? formatFashnError(body?.error));
        }

        return body.id;
    }

    /**
     * How long to wait before the next status check.
     *
     * A flat interval meant the buyer could sit staring at the try-on spinner for a
     * further full interval after the image was already rendered — pure dead time on
     * a feature people judge by how quickly it responds. Checking sooner at first and
     * then easing off keeps the fast cases fast without hammering FASHN for the slow
     * ones, and never exceeds the configured interval as a ceiling.
     */
    private pollDelayMs(attempt: number): number {
        const ceiling = env.FASHN_POLL_INTERVAL_MS;
        if (attempt === 0) return Math.min(800, ceiling);
        if (attempt < 5) return Math.min(900, ceiling);
        if (attempt < 12) return Math.min(1500, ceiling);
        // Settles below the configured interval so it never detects completion
        // later than the old flat schedule did.
        return Math.min(2500, ceiling);
    }

    private async pollPrediction(predictionId: string): Promise<FashnStatusResponse> {
        const startedAt = Date.now();
        let attempt = 0;

        while (Date.now() - startedAt < env.FASHN_POLL_TIMEOUT_MS) {
            await wait(this.pollDelayMs(attempt));
            attempt += 1;

            const response = await fetch(`${FASHN_BASE_URL}/status/${encodeURIComponent(predictionId)}`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });

            const body = (await response.json().catch(() => null)) as FashnStatusResponse | null;
            if (!response.ok || !body) {
                logger.warn({ status: response.status, predictionId, body }, 'FASHN try-on status failed');
                throw new ApiError(502, 'Unable to check virtual try-on status');
            }

            if (body.status === 'completed') return body;
            if (body.status === 'failed') {
                throw new ApiError(502, formatFashnError(body.error));
            }
        }

        throw new ApiError(504, 'Virtual try-on is still processing. Please try again in a moment.');
    }
}

export const fashnTryOnService = new FashnTryOnService();
