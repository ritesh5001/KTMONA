/**
 * Gives every product a stable `slug`, which Shiprocket uses as the product
 * `handle`.
 *
 * Deriving the handle from the title on each request would mean a title edit
 * silently creates a new product on Shiprocket's side and orphans the old one,
 * so it is written once here and never recomputed. Titles collide (several
 * products share "…Modi Jacket Black"), so a colliding slug gets the numeric
 * external id appended — stable, because that id never changes.
 *
 *   npm run backfill:product-slugs           # dry run
 *   npm run backfill:product-slugs -- --apply
 */
import { prisma } from '../src/config/db.js';
import { slugify } from '../src/services/shiprocket-catalog.service.js';

async function main() {
    const apply = process.argv.includes('--apply');

    const products = await prisma.product.findMany({
        where: { slug: null },
        select: { id: true, title: true, externalId: true },
        orderBy: { createdAt: 'asc' },
    });

    const taken = new Set(
        (
            await prisma.product.findMany({
                where: { slug: { not: null } },
                select: { slug: true },
            })
        ).map((row) => row.slug!)
    );

    console.log(
        `[backfill-product-slugs] mode=${apply ? 'APPLY' : 'DRY-RUN'} missing=${products.length}`
    );

    let written = 0;
    for (const product of products) {
        const base = slugify(product.title) || 'product';
        let slug = base;

        if (taken.has(slug)) {
            const suffix = product.externalId == null ? product.id.slice(-6) : String(product.externalId);
            slug = `${base}-${suffix}`;
        }
        // Belt and braces: a suffixed slug could still collide if the same
        // product were processed twice.
        let attempt = 2;
        while (taken.has(slug)) {
            slug = `${base}-${attempt}`;
            attempt += 1;
        }

        taken.add(slug);
        written += 1;

        if (!apply) {
            if (written <= 10) console.log(`  ${product.title}  ->  ${slug}`);
            continue;
        }

        await prisma.product.update({ where: { id: product.id }, data: { slug } });
    }

    console.log(
        `[backfill-product-slugs] complete mode=${apply ? 'APPLY' : 'DRY-RUN'} slugs=${written}`
    );
}

main()
    .catch((error) => {
        console.error('[backfill-product-slugs] failed', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
