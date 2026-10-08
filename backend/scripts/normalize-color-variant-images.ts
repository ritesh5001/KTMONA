import { prisma } from '../src/config/db.js';
import { buildColorScopedImageUpdates } from '../src/services/color-variant-images.service.js';

async function main() {
  const apply = process.argv.includes('--apply');
  const modeLabel = apply ? 'APPLY' : 'DRY-RUN';

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      variants: {
        select: {
          id: true,
          color: true,
          images: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  let affectedProducts = 0;
  let affectedVariants = 0;

  console.log(`[normalize-color-variant-images] mode=${modeLabel} products=${products.length}`);

  for (const product of products) {
    const updates = buildColorScopedImageUpdates(
      (product.variants ?? []).map((variant) => ({
        id: variant.id,
        color: variant.color ?? null,
        images: variant.images ?? [],
      }))
    );

    if (updates.length === 0) {
      continue;
    }

    affectedProducts += 1;
    affectedVariants += updates.length;
    console.log(
      `[normalize-color-variant-images] product=${product.id} title="${product.title}" updates=${updates.length}`
    );

    if (!apply) {
      continue;
    }

    await prisma.$transaction(
      updates.map((variant) =>
        prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            images: variant.images,
          },
        })
      )
    );
  }

  console.log(
    `[normalize-color-variant-images] complete mode=${modeLabel} affectedProducts=${affectedProducts} affectedVariants=${affectedVariants}`
  );
}

main()
  .catch((error) => {
    console.error('[normalize-color-variant-images] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
