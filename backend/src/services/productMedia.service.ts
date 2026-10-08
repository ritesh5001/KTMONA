/**
 * Product Media Service
 * Business logic for product media attachments (images, videos)
 */

import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import type { CreateMediaInput, UpdateMediaInput } from '../validators/media.validation.js';

export class ProductMediaService {
    /**
     * Add media to a product (seller only, ownership verified)
     */
    async addMedia(productId: string, sellerId: string, input: CreateMediaInput) {
        // Verify product exists and belongs to seller
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, sellerId: true },
        });
        if (!product) throw ApiError.notFound('Product not found');
        if (product.sellerId !== sellerId) throw ApiError.forbidden('Not product owner');

        // Enforce single thumbnail per product
        if (input.isThumbnail) {
            const existingThumbnail = await prisma.productMedia.findFirst({
                where: { productId, isThumbnail: true },
            });
            if (existingThumbnail) {
                throw ApiError.badRequest('Product already has a thumbnail. Update or remove the existing one first.');
            }
        }

        const media = await prisma.productMedia.create({
            data: {
                productId,
                type: input.type,
                url: input.url,
                isThumbnail: input.isThumbnail ?? false,
                sortOrder: input.sortOrder ?? 0,
            },
        });

        return media;
    }

    /**
     * Update media metadata (seller only, ownership verified)
     */
    async updateMedia(mediaId: string, sellerId: string, input: UpdateMediaInput) {
        const media = await prisma.productMedia.findUnique({
            where: { id: mediaId },
            include: { product: { select: { sellerId: true } } },
        });
        if (!media) throw ApiError.notFound('Media not found');
        if (media.product.sellerId !== sellerId) throw ApiError.forbidden('Not product owner');

        // Enforce single thumbnail if setting this as thumbnail
        if (input.isThumbnail === true && !media.isThumbnail) {
            const existingThumbnail = await prisma.productMedia.findFirst({
                where: { productId: media.productId, isThumbnail: true, id: { not: mediaId } },
            });
            if (existingThumbnail) {
                throw ApiError.badRequest('Product already has a thumbnail. Remove the existing one first.');
            }
        }

        const updated = await prisma.productMedia.update({
            where: { id: mediaId },
            data: {
                ...(input.type !== undefined && { type: input.type }),
                ...(input.url !== undefined && { url: input.url }),
                ...(input.isThumbnail !== undefined && { isThumbnail: input.isThumbnail }),
                ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
            },
        });

        return updated;
    }

    /**
     * Delete media (seller only, ownership verified)
     */
    async deleteMedia(mediaId: string, sellerId: string) {
        const media = await prisma.productMedia.findUnique({
            where: { id: mediaId },
            include: { product: { select: { sellerId: true } } },
        });
        if (!media) throw ApiError.notFound('Media not found');
        if (media.product.sellerId !== sellerId) throw ApiError.forbidden('Not product owner');

        await prisma.productMedia.delete({ where: { id: mediaId } });
    }
}

export const productMediaService = new ProductMediaService();
