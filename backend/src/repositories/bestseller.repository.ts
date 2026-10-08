import { prisma } from '../config/db.js';

export class BestsellerRepository {
    /**
     * Admin bestseller list.
     *
     * One JOIN instead of nested includes: Prisma 4 would resolve
     * bestseller -> product -> category / seller as four separate statements, and
     * against a cross-region database each one is a full round-trip. That is absurd
     * for a list capped at four rows.
     *
     * The returned shape intentionally matches the nested version the service maps
     * over (`item.product.category.name` etc.) so callers are unaffected.
     */
    async listAdmin() {
        const rows = await prisma.$queryRaw<Array<Record<string, any>>>`
            SELECT
                b."id", b."product_id" AS "productId", b."position",
                p."title", p."images",
                p."is_published"     AS "isPublished",
                p."deleted_by_admin" AS "deletedByAdmin",
                c."name"             AS "categoryName",
                u."email"            AS "sellerEmail"
            FROM "bestsellers" b
            INNER JOIN "products" p   ON p."id" = b."product_id"
            LEFT  JOIN "categories" c ON c."id" = p."category_id"
            LEFT  JOIN "users" u      ON u."id" = p."seller_id"
            ORDER BY b."position" ASC
        `;

        return rows.map((row) => ({
            id: row['id'] as string,
            productId: row['productId'] as string,
            position: row['position'] as number,
            product: {
                title: row['title'] as string,
                images: (row['images'] ?? []) as string[],
                isPublished: row['isPublished'] as boolean,
                deletedByAdmin: row['deletedByAdmin'] as boolean,
                category: row['categoryName'] == null ? null : { name: row['categoryName'] as string },
                seller: row['sellerEmail'] == null ? null : { email: row['sellerEmail'] as string },
            },
        }));
    }

    async listPublic(limit: number, audience?: 'MENS' | 'KIDS') {
        return prisma.bestseller.findMany({
            where: {
                product: {
                    isPublished: true,
                    status: 'APPROVED',
                    deletedByAdmin: false,
                    ...(audience ? { audience } : {}),
                },
            },
            orderBy: { position: 'asc' },
            take: limit,
            include: {
                product: {
                    include: {
                        variants: {
                            where: { status: 'APPROVED' },
                        },
                        category: { select: { name: true } },
                    },
                },
            },
        });
    }

    async findByProductId(productId: string) {
        return prisma.bestseller.findUnique({
            where: { productId },
        });
    }

    async create(productId: string, position: number) {
        return prisma.bestseller.create({
            data: { productId, position },
        });
    }

    async update(id: string, position: number) {
        return prisma.bestseller.update({
            where: { id },
            data: { position },
        });
    }

    async delete(id: string) {
        return prisma.bestseller.delete({
            where: { id },
        });
    }

    async deleteByProductId(productId: string) {
        return prisma.bestseller.deleteMany({
            where: { productId },
        });
    }

    async getMaxPosition(): Promise<number> {
        const result = await prisma.bestseller.aggregate({
            _max: { position: true },
        });
        return result._max.position ?? 0;
    }

    async countAll(): Promise<number> {
        return prisma.bestseller.count();
    }
}

export const bestsellerRepository = new BestsellerRepository();
