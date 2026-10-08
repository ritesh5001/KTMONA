/**
 * Product Media Service
 * Business logic for product media attachments (images, videos)
 */
import type { CreateMediaInput, UpdateMediaInput } from '../validators/media.validation.js';
export declare class ProductMediaService {
    /**
     * Add media to a product (seller only, ownership verified)
     */
    addMedia(productId: string, sellerId: string, input: CreateMediaInput): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        type: import(".prisma/client").MediaType;
        url: string;
        isThumbnail: boolean;
        sortOrder: number;
        createdAt: Date;
    }, unknown> & {}>;
    /**
     * Update media metadata (seller only, ownership verified)
     */
    updateMedia(mediaId: string, sellerId: string, input: UpdateMediaInput): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        type: import(".prisma/client").MediaType;
        url: string;
        isThumbnail: boolean;
        sortOrder: number;
        createdAt: Date;
    }, unknown> & {}>;
    /**
     * Delete media (seller only, ownership verified)
     */
    deleteMedia(mediaId: string, sellerId: string): Promise<void>;
}
export declare const productMediaService: ProductMediaService;
//# sourceMappingURL=productMedia.service.d.ts.map