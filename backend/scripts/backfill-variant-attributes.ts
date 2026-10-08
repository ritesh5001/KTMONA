/**
 * Repairs the colour / size / SKU columns on every product variant.
 *
 * The catalogue import folded the colour into the size cell ("GREEN38", "LB44")
 * and left `color` empty, so the storefront drew one "Default" swatch and a row
 * of size chips that read like SKUs. Worse, the glued prefix is frequently
 * wrong — three different CREP jackets (Navy Blue, Dark Green, Cream) all carry
 * "BLACK" — so the prefix is only trustworthy as a *discriminator* between the
 * colours of one product, never as the colour name itself.
 *
 * Colour is therefore resolved from the most reliable evidence available:
 *
 *   1. Image filenames. The vendor named their assets after the garment
 *      ("2114DarkBlueFront.jpg", "6340_pink_f.png") — the strongest signal, and
 *      the only one that can name each colour of a multi-colour product.
 *   2. The product title ("… Modi Jacket CREP Navy Blue"), which is what the
 *      buyer reads, so the swatch must not contradict it.
 *   3. The glued size prefix, expanded ("NAVYBLUE" -> "Navy Blue").
 *
 * On a multi-colour product each distinct prefix is paired with an image colour
 * by initials (LB -> Light Blue, DC -> Dark Cream), falling back to order of
 * first appearance. That also lets us split the shared product gallery into
 * per-colour galleries, so picking "Cream" stops showing the white photos.
 *
 *   npm run backfill:variant-attributes           # dry run, prints the plan
 *   npm run backfill:variant-attributes -- --apply
 *
 * `--apply` writes a snapshot of every affected row to
 * `.db-migration/variant-attributes-backup-<timestamp>.json` first, so the
 * previous colour/size/SKU/images can be restored if a mapping turns out wrong.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/config/db.js';
import {
    buildSku,
    compareSizes,
    extractColorPhrase,
    parseSizeLabel,
    resolveColorHex,
    titleCaseColor,
} from '../src/services/variant-attributes.service.js';

interface VariantRow {
    id: string;
    size: string;
    color: string | null;
    colorHex: string | null;
    sku: string;
    images: string[];
}

interface VariantPlan {
    id: string;
    /** The untouched row, kept verbatim so `--apply` can snapshot it. */
    before: VariantRow;
    size: string;
    color: string | null;
    colorHex: string | null;
    sku: string;
    images: string[];
    changed: boolean;
}

/** Filenames that describe the listing rather than the garment. */
const NON_GARMENT_IMAGE = /size[_\s-]*chart|sizechart|measurement/i;

function imageFileName(url: string): string {
    const path = url.split('?')[0] ?? url;
    return path.slice(path.lastIndexOf('/') + 1);
}

/** A plain word, so "…_Maroon" survives while "…_j9-PlrH5ra" does not. */
const PLAIN_WORD = /^([A-Za-z][a-z]*|[A-Z]+)$/;

/**
 * ImageKit appends a random upload id ("…_j9-PlrH5ra.jpg") and vendors sometimes
 * glue a UUID in the middle. Strip both so only the descriptive part is
 * tokenised — the id is always the final underscore-delimited segment.
 */
function describableName(url: string): string {
    const withoutNoise = imageFileName(url)
        .replace(/\.[a-z0-9]{2,4}$/i, '')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ' ');

    const segments = withoutNoise.split('_');
    const last = segments[segments.length - 1] ?? '';
    if (segments.length > 1 && last.length >= 6 && !PLAIN_WORD.test(last)) {
        segments.pop();
    }

    return segments.join('_');
}

/** Initials of a colour phrase: "dark blue" -> "db". */
function initials(phrase: string): string {
    return phrase
        .split(' ')
        .map((word) => word.charAt(0))
        .join('')
        .toLowerCase();
}

/** Colour names mentioned by this product's images, in first-appearance order. */
function colorsFromImages(images: string[]): string[] {
    const found: string[] = [];
    for (const url of images) {
        if (NON_GARMENT_IMAGE.test(url)) continue;
        const color = extractColorPhrase(describableName(url));
        if (color && !found.includes(color)) found.push(color);
    }
    return found;
}

/**
 * Pairs each glued size prefix with a colour name. Initials win ("LB" ->
 * "light blue"); leftovers are matched in order of first appearance, which is
 * what rescues prefixes the vendor mistyped.
 */
function mapPrefixesToColors(prefixes: string[], imageColors: string[]): Map<string, string | null> {
    const result = new Map<string, string | null>();
    const unclaimed = [...imageColors];

    for (const prefix of prefixes) {
        const key = prefix.toLowerCase().replace(/\s+/g, '');
        const index = unclaimed.findIndex(
            (color) => initials(color) === key || color.replace(/\s+/g, '') === key
        );
        if (index >= 0) {
            result.set(prefix, unclaimed.splice(index, 1)[0]!);
        }
    }

    for (const prefix of prefixes) {
        if (result.has(prefix)) continue;
        const next = unclaimed.shift();
        // Nothing left in the gallery: expand the prefix itself ("NAVYBLUE"),
        // and failing that keep the raw prefix so this group stays a distinct
        // swatch an admin can rename rather than merging into a sibling.
        result.set(prefix, next ?? extractColorPhrase(prefix) ?? prefix.toLowerCase());
    }

    return result;
}

/**
 * Splits a shared gallery into per-colour galleries. Photos that name no colour
 * (size charts, generic shots) go to every colour so no gallery ends up empty.
 */
function galleryByColor(images: string[], colors: string[]): Map<string, string[]> {
    const buckets = new Map<string, string[]>(colors.map((color) => [color, []]));
    const shared: string[] = [];

    for (const url of images) {
        const color = NON_GARMENT_IMAGE.test(url) ? null : extractColorPhrase(describableName(url));
        if (color && buckets.has(color)) {
            buckets.get(color)!.push(url);
        } else {
            shared.push(url);
        }
    }

    for (const [color, bucket] of buckets) {
        // A colour with no photo of its own falls back to the whole gallery
        // rather than showing nothing.
        buckets.set(color, bucket.length > 0 ? [...bucket, ...shared] : [...images]);
    }

    return buckets;
}

/** The stable part of a vendor SKU: colour and size stripped off the tail. */
function skuBase(sku: string, originalSize: string): string {
    let base = sku.trim();

    const tail = new RegExp(`[-_ ]?${originalSize.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    base = base.replace(tail, '');

    const trailingColor = extractColorPhrase(base);
    if (trailingColor) {
        const glued = trailingColor.replace(/\s+/g, '');
        base = base.replace(new RegExp(`[-_ ]?(${glued}|${trailingColor.split(' ').join('[-_ ]')})$`, 'i'), '');
    }

    base = base.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (base.length > 40) {
        const cut = base.slice(0, 40);
        const boundary = cut.lastIndexOf('-');
        base = boundary > 12 ? cut.slice(0, boundary) : cut;
    }

    return base.toUpperCase() || 'SKU';
}

function planProduct(product: {
    id: string;
    title: string;
    images: string[];
    variants: VariantRow[];
}): VariantPlan[] {
    const parsed = product.variants.map((variant) => ({
        variant,
        ...parseSizeLabel(variant.size),
    }));

    const prefixes: string[] = [];
    for (const row of parsed) {
        if (row.colorPrefix && !prefixes.includes(row.colorPrefix)) prefixes.push(row.colorPrefix);
    }

    const imageColors = colorsFromImages(product.images);
    const titleColor = extractColorPhrase(product.title);

    // A product carries a real colour axis only when its variants disagree —
    // either through the glued prefix or through a colour already on the row.
    const existingColors: string[] = [];
    for (const row of parsed) {
        const existing = row.variant.color?.trim().toLowerCase();
        if (existing && !existingColors.includes(existing)) existingColors.push(existing);
    }

    const multiColor = prefixes.length > 1 || existingColors.length > 1;
    const prefixColors = multiColor ? mapPrefixesToColors(prefixes, imageColors) : new Map<string, string | null>();

    /** Colour for one variant, in evidence order. */
    const colorFor = (row: (typeof parsed)[number]): string | null => {
        if (multiColor) {
            if (row.colorPrefix) {
                // Never borrow a sibling's colour here: two prefixes that
                // collapse to one name would merge two real colours into one
                // swatch and duplicate every size under it.
                return prefixColors.get(row.colorPrefix) ?? row.variant.color?.trim().toLowerCase() ?? null;
            }
            return row.variant.color?.trim().toLowerCase() ?? titleColor ?? null;
        }

        // Single colour: the title is what the buyer reads, so it wins over a
        // filename; the glued prefix is the last resort.
        return (
            titleColor ??
            (imageColors.length === 1 ? imageColors[0]! : null) ??
            row.variant.color?.trim().toLowerCase() ??
            (row.colorPrefix ? extractColorPhrase(row.colorPrefix) : null) ??
            null
        );
    };

    const resolved = parsed.map((row) => ({ ...row, color: colorFor(row) }));

    const distinctColors: string[] = [];
    for (const row of resolved) {
        if (row.color && !distinctColors.includes(row.color)) distinctColors.push(row.color);
    }

    // Only split the gallery when the product genuinely has several colours and
    // the photos name them; otherwise leave images alone and let the storefront
    // fall back to the product gallery.
    const shouldSplitGallery = distinctColors.length > 1 && imageColors.length > 1;
    const galleries = shouldSplitGallery
        ? galleryByColor(product.images, distinctColors)
        : new Map<string, string[]>();

    const usedSkus = new Set<string>();

    return resolved.map((row) => {
        const color = row.color ? titleCaseColor(row.color) : null;
        const colorHex = resolveColorHex(color) ?? row.variant.colorHex ?? null;

        let sku = buildSku(skuBase(row.variant.sku, row.variant.size), color, row.size);
        if (usedSkus.has(sku)) {
            let suffix = 2;
            while (usedSkus.has(`${sku}-${suffix}`)) suffix += 1;
            sku = `${sku}-${suffix}`;
        }
        usedSkus.add(sku);

        const images = shouldSplitGallery && row.color
            ? galleries.get(row.color) ?? row.variant.images
            : row.variant.images;

        const changed =
            row.size !== row.variant.size ||
            color !== row.variant.color ||
            colorHex !== row.variant.colorHex ||
            sku !== row.variant.sku ||
            images.join('|') !== row.variant.images.join('|');

        return {
            id: row.variant.id,
            before: row.variant,
            size: row.size,
            color,
            colorHex,
            sku,
            images,
            changed,
        };
    });
}

async function main() {
    const apply = process.argv.includes('--apply');
    const verbose = process.argv.includes('--verbose');

    const products = await prisma.product.findMany({
        select: {
            id: true,
            title: true,
            images: true,
            variants: {
                select: { id: true, size: true, color: true, colorHex: true, sku: true, images: true },
                orderBy: { createdAt: 'asc' },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    console.log(
        `[backfill-variant-attributes] mode=${apply ? 'APPLY' : 'DRY-RUN'} products=${products.length}`
    );

    let changedProducts = 0;
    let changedVariants = 0;
    let colorsFilled = 0;
    let sizesFixed = 0;
    let galleriesSplit = 0;

    /** Every row we are about to overwrite, verbatim, for the rollback file. */
    const snapshot: VariantRow[] = [];
    /** Planned writes, held until the snapshot is safely on disk. */
    const pending: VariantPlan[][] = [];

    for (const product of products) {
        if (product.variants.length === 0) continue;

        const plans = planProduct(product);
        const changes = plans.filter((plan) => plan.changed);
        if (changes.length === 0) continue;

        changedProducts += 1;
        changedVariants += changes.length;
        colorsFilled += changes.filter((plan) => !plan.before.color && plan.color).length;
        sizesFixed += changes.filter((plan) => plan.before.size !== plan.size).length;
        galleriesSplit += changes.filter(
            (plan) => plan.before.images.length !== plan.images.length
        ).length;
        snapshot.push(...changes.map((plan) => plan.before));

        const colorSummary = [...new Set(plans.map((plan) => plan.color ?? '—'))].join(', ');
        const sizeSummary = [...new Set(plans.map((plan) => plan.size))].sort(compareSizes).join(', ');
        console.log(`\n  ${product.title}`);
        console.log(`    colours: ${colorSummary}`);
        console.log(`    sizes:   ${sizeSummary}`);

        if (verbose) {
            for (const plan of changes) {
                console.log(
                    `      ${plan.before.size} / ${plan.before.color ?? 'null'} / ${plan.before.sku}` +
                        `  ->  ${plan.size} / ${plan.color ?? 'null'} ${plan.colorHex ?? ''} / ${plan.sku}` +
                        ` (${plan.before.images.length} -> ${plan.images.length} imgs)`
                );
            }
        }

        pending.push(changes);
    }

    if (apply && snapshot.length > 0) {
        const scriptDir = dirname(fileURLToPath(import.meta.url));
        const backupDir = resolve(scriptDir, '..', '.db-migration');
        const backupPath = resolve(
            backupDir,
            `variant-attributes-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
        );

        await mkdir(backupDir, { recursive: true });
        await writeFile(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');
        console.log(`\n[backfill-variant-attributes] snapshot written: ${backupPath}`);
    }

    if (apply) {
        for (const changes of pending) {
            // One transaction per product so a mid-run failure can't leave a
            // single product half-renamed.
            await prisma.$transaction(
                changes.map((plan) =>
                    prisma.productVariant.update({
                        where: { id: plan.id },
                        data: {
                            size: plan.size,
                            color: plan.color,
                            colorHex: plan.colorHex,
                            sku: plan.sku,
                            images: plan.images,
                        },
                    })
                )
            );
        }
        console.log(`[backfill-variant-attributes] wrote ${pending.length} products`);
    }

    console.log(
        `\n[backfill-variant-attributes] complete mode=${apply ? 'APPLY' : 'DRY-RUN'}` +
            ` products=${changedProducts} variants=${changedVariants}` +
            ` coloursFilled=${colorsFilled} sizesFixed=${sizesFixed} galleriesScoped=${galleriesSplit}`
    );
}

main()
    .catch((error) => {
        console.error('[backfill-variant-attributes] failed', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
