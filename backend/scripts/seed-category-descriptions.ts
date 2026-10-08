/**
 * Gives every collection a description.
 *
 * `Category.description` was empty across the board, which surfaced as
 * `"body_html": ""` on every entry of the Shiprocket collections feed — and as a
 * blank collection header on the storefront. This writes a short, accurate
 * description for each.
 *
 * Only fills blanks: a category someone has already written copy for is left
 * alone, so this is safe to re-run and never overwrites edits made in the admin
 * panel.
 *
 *   npm run seed:category-descriptions           # dry run
 *   npm run seed:category-descriptions -- --apply
 */
import { prisma } from '../src/config/db.js';

/** Keyed by slug, so renaming a category display name does not break this. */
const DESCRIPTIONS: Record<string, string> = {
    kurta:
        'Hand-finished ethnic kurtas in jacquard, cotton and silk blends. Cut for ' +
        'weddings, festivals and everyday wear, in chest sizes 36 to 44.',

    shirts:
        'Slim-fit shirts that move between office formals and smart casual. ' +
        'Breathable fabrics, tailored through the body, in sizes M to XXL.',

    'modi-jacket':
        'Sleeveless Nehru-collar jackets worn over a kurta — the quickest way to ' +
        'lift an outfit into occasion wear. Solids and textured weaves, sizes 36 to 44.',

    jacket:
        'Ethnic and formal jackets, from Nehru collars to structured blazers. The ' +
        'layer that turns a kurta or a shirt into something you can wear to a wedding.',

    jodhpuri:
        'Closed-collar Jodhpuri suits with matching trousers. Formal Indian ' +
        'tailoring for weddings, receptions and evening functions.',

    'open-jodhpuri':
        'Open-front Jodhpuri sets, worn over a kurta for a layered silhouette. A ' +
        'lighter alternative to a closed bandhgala for daytime functions.',

    sherwani:
        'Full-length sherwanis for the groom and the wedding party. Structured and ' +
        'embroidered, cut to be worn over a kurta and churidar.',

    'formal-pants':
        'Ankle-length and full-length formal trousers in linen, cotton and blends. ' +
        'Slim through the leg, in waist sizes 28 to 40.',
};

async function main() {
    const apply = process.argv.includes('--apply');

    const categories = await prisma.category.findMany({
        select: { id: true, name: true, slug: true, description: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    console.log(`[seed-category-descriptions] mode=${apply ? 'APPLY' : 'DRY-RUN'}`);

    let written = 0;
    let skipped = 0;
    const unmapped: string[] = [];

    for (const category of categories) {
        const copy = DESCRIPTIONS[category.slug];
        if (!copy) {
            unmapped.push(`${category.name} (${category.slug})`);
            continue;
        }

        // Someone's own words beat ours.
        if (category.description?.trim()) {
            skipped += 1;
            continue;
        }

        written += 1;
        console.log(`  ${category.name}: ${copy.slice(0, 72)}…`);

        if (apply) {
            await prisma.category.update({
                where: { id: category.id },
                data: { description: copy },
            });
        }
    }

    if (unmapped.length > 0) {
        console.log(`\n  no copy defined for: ${unmapped.join(', ')}`);
    }

    console.log(
        `\n[seed-category-descriptions] complete mode=${apply ? 'APPLY' : 'DRY-RUN'}` +
            ` written=${written} keptExisting=${skipped} unmapped=${unmapped.length}`
    );
}

main()
    .catch((error) => {
        console.error('[seed-category-descriptions] failed', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
