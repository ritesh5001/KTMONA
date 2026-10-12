/**
 * Adds four client-supplied products (Oct 2026) and publishes them.
 *
 * Runs the same code paths as the panels: the seller's single catalog upload
 * (Seller → Catalog Uploads → Single) followed by admin approval (Catalog QC),
 * so slugs, SKUs, stock, caches and notifications behave like a normal listing.
 *
 * Seller: the only seller account on the database (refuses if there are more).
 * Category: picked by name from the existing tree; the dry run prints the
 * chosen paths so they can be checked before anything is written.
 *
 *   npx tsx scripts/add-products-2026-10.ts            # dry run, writes nothing
 *   npx tsx scripts/add-products-2026-10.ts --apply    # upload images + create + approve
 *
 * Repair (products created with placeholder image links on 12 Oct 2026):
 *   npx tsx scripts/add-products-2026-10.ts --fix-images            # show what would change
 *   npx tsx scripts/add-products-2026-10.ts --fix-images --apply    # upload real images + swap links
 *
 * Re-running with --apply skips products the seller already has (same title).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ImageKit from 'imagekit';
import { prisma } from '../src/config/db.js';
import { sellerCatalogUploadsService, type CatalogProductInput } from '../src/services/seller-center/catalog-uploads.service.js';
import { categoryAttributeService } from '../src/services/category-attribute.service.js';
import { adminService } from '../src/services/admin.service.js';
import { invalidateProductCaches } from '../src/utils/cache.util.js';

const APPLY = process.argv.includes('--apply');
/** Local testing only: use placeholder image URLs instead of uploading. */
const SKIP_UPLOAD = process.argv.includes('--skip-upload');
const FIX_IMAGES = process.argv.includes('--fix-images');
const PLACEHOLDER = 'ik.imagekit.io/placeholder/';

/** The database the Prisma client will actually use (same rule as src/config/db.ts). */
function databaseHost(): string {
    const raw = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || '';
    try {
        return new URL(raw).hostname;
    } catch {
        return '(unparseable DATABASE_URL)';
    }
}
const IS_LOCAL_DB = ['localhost', '127.0.0.1', '::1'].includes(databaseHost());
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'products-2026-10');

type Spec = {
    image: string;
    /** Leaf category names to look for, best first. */
    categoryNames: string[];
    /** The category path must match this (e.g. men's, not women's, T-shirts). */
    pathMustMatch?: RegExp;
    pathMustNotMatch?: RegExp;
    product: Omit<CatalogProductInput, 'images'>;
};

const APPAREL_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const SPECS: Spec[] = [
    {
        image: 'navy-floral-georgette-saree.png',
        categoryNames: ['Georgette Sarees', 'Georgette Saree', 'Sarees', 'Saree'],
        product: {
            name: 'Women’s Floral Print Georgette Saree – Navy Blue',
            description:
                'Elevate your ethnic style with this elegant navy blue floral-print georgette saree. Featuring a beautiful floral design, a matching blouse and a graceful drape, it is suitable for festive occasions, parties and special gatherings.\n\n' +
                'Colour: Navy Blue\nFabric: Georgette\nPattern: Floral Print\nOccasion: Party Wear, Festive Wear, Casual Wear\nBlouse: Matching blouse design\n' +
                'Care Instructions: Gentle hand wash or dry clean as recommended on the product label.',
            color: 'Navy Blue',
            netWeightGrams: 500,
            attributes: {
                Color: 'Navy Blue',
                'Saree Fabric': 'Georgette',
                Pattern: 'Floral',
                Blouse: 'Matching blouse',
                Occasion: 'Party, Festive, Casual',
                'Net Quantity (N)': '1',
                'Care Instructions': 'Gentle hand wash or dry clean',
            },
            legal: {},
            sizes: [{ size: 'Free Size', sellerPrice: 699, mrp: 1999, stock: 50 }],
        },
    },
    {
        image: 'navy-cotton-tshirt.png',
        categoryNames: ['T-Shirts', 'T-Shirt', 'Tshirts', 'Tees'],
        pathMustMatch: /\bmen/i,
        pathMustNotMatch: /women|girl|kid/i,
        product: {
            name: 'Men’s Premium Round Neck T-Shirt – Navy Blue',
            description:
                'A navy blue solid T-shirt with a classic round neck and half sleeves, made for everyday casual wear.\n\n' +
                'Colour: Navy Blue\nNeck: Round Neck\nSleeve: Half Sleeve\nPattern: Solid\nStyle: Casual Wear',
            color: 'Navy Blue',
            netWeightGrams: 200,
            attributes: {
                Color: 'Navy Blue',
                Pattern: 'Solid',
                Neck: 'Round Neck',
                'Sleeve Length': 'Short Sleeves',
                Occasion: 'Casual',
                'Net Quantity (N)': '1',
            },
            legal: {},
            sizes: APPAREL_SIZES.map((size) => ({ size, sellerPrice: 299, mrp: 799, stock: 20 })),
        },
    },
    {
        image: 'red-casual-shirt.png',
        categoryNames: ['Casual Shirts', 'Shirts', 'Shirt'],
        pathMustMatch: /\bmen/i,
        pathMustNotMatch: /women|girl|kid|t-?shirt/i,
        product: {
            name: 'Men’s Premium Red Casual Shirt',
            description:
                'A solid red full-sleeve shirt with a classic collar and chest pocket, for casual and smart-casual looks.\n\n' +
                'Colour: Red\nSleeves: Full Sleeve\nPattern: Solid\nCollar: Classic Collar\nStyle: Casual / Smart Casual',
            color: 'Red',
            netWeightGrams: 250,
            attributes: {
                Color: 'Red',
                Pattern: 'Solid',
                'Sleeve Length': 'Long Sleeves',
                Collar: 'Classic Collar',
                Occasion: 'Casual',
                'Net Quantity (N)': '1',
            },
            legal: {},
            sizes: APPAREL_SIZES.map((size) => ({ size, sellerPrice: 499, mrp: 1299, stock: 20 })),
        },
    },
    {
        image: 'type-c-data-cable.png',
        categoryNames: ['Data Cables', 'USB Cables', 'Charging Cables', 'Cables', 'Chargers & Cables', 'Cables & Chargers', 'Mobile Accessories'],
        product: {
            name: 'USB Type-C Data Cable – White (1 m)',
            description:
                'Charge your devices and transfer data with this practical USB Type-C data cable. Designed with a durable outer covering and flexible construction, it is suitable for everyday charging and data syncing with compatible devices.\n\n' +
                'Product Type: USB Type-C Data Cable\nColour: White\nConnector 1: USB Type-C\nConnector 2: USB-A\nCable Length: 1 Meter\n' +
                'Features: Flexible design, convenient portability, charging and data transfer\nCompatibility: Devices with a USB Type-C port\nPackage Includes: 1 × USB Type-C Data Cable\n\n' +
                'Note: Charging speed and data transfer performance depend on the cable specifications and connected devices.',
            color: 'White',
            netWeightGrams: 50,
            attributes: {
                Color: 'White',
                'Generic Name': 'USB Type-C Data Cable',
                'Model Name': 'Type-C to USB-A Cable 1m',
                'Connector 1': 'USB Type-C',
                'Connector 2': 'USB-A',
                'Cable Length': '1 Meter',
                'Power Source': 'USB',
                'Net Quantity (N)': '1',
            },
            legal: {},
            sizes: [{ size: '1 m', sellerPrice: 149, mrp: 399, stock: 100 }],
        },
    },
];

type Cat = { id: string; name: string; parentId: string | null; isActive: boolean };

function pathOf(cat: Cat, byId: Map<string, Cat>): string {
    const parts: string[] = [];
    let cur: Cat | undefined = cat;
    for (let i = 0; cur && i < 10; i++) {
        parts.unshift(cur.name);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(' › ');
}

function pickCategory(spec: Spec, cats: Cat[], byId: Map<string, Cat>, hasChildren: Set<string>) {
    for (const wanted of spec.categoryNames) {
        const matches = cats
            .filter((c) => c.isActive && norm(c.name) === norm(wanted))
            .map((c) => ({ cat: c, path: pathOf(c, byId) }))
            .filter((m) => (!spec.pathMustMatch || spec.pathMustMatch.test(m.path)) && !spec.pathMustNotMatch?.test(m.path))
            // Leaf categories first, then the shortest path.
            .sort((a, b) => Number(hasChildren.has(a.cat.id)) - Number(hasChildren.has(b.cat.id)) || a.path.length - b.path.length);
        if (matches[0]) return matches[0];
    }
    return null;
}

/** Fill admin-configured fields (Category Builder) from our values; report required gaps. */
async function applyCategoryFields(categoryId: string, attrs: Record<string, string>) {
    const { fields } = await categoryAttributeService.resolve(categoryId);
    if (!fields) return { attributes: attrs, missing: [] as string[] };
    const out: Record<string, string> = { ...attrs };
    const missing: string[] = [];
    for (const f of fields) {
        const ours = Object.entries(attrs).find(([k]) => norm(k) === norm(f.key) || norm(k) === norm(f.label))?.[1];
        let value = ours ?? '';
        if (value && f.type === 'SELECT' && f.options.length) {
            const opt = f.options.find((o) => norm(o) === norm(value)) ?? f.options.find((o) => norm(value).includes(norm(o)) || norm(o).includes(norm(value)));
            value = opt ?? '';
        }
        if (value) out[f.key] = value;
        else if (f.required) missing.push(f.label);
    }
    return { attributes: out, missing };
}

async function uploadImage(file: string): Promise<string> {
    if (SKIP_UPLOAD) return `https://ik.imagekit.io/placeholder/${file}`;
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY?.trim();
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT?.trim();
    if (!publicKey || !privateKey || !urlEndpoint) throw new Error('ImageKit is not configured (IMAGEKIT_* in .env)');
    const ik = new ImageKit({ publicKey, privateKey, urlEndpoint });
    const res = await ik.upload({ file: await readFile(path.join(ASSETS, file)), fileName: file, folder: '/products', useUniqueFileName: true });
    return res.url;
}

/** Swap placeholder image links on this seller's listings for the real uploaded images. */
async function fixImages(sellerId: string) {
    let changed = 0;
    for (const spec of SPECS) {
        const products = await prisma.product.findMany({
            where: { sellerId, title: spec.product.name },
            select: { id: true, images: true, variants: { select: { id: true, images: true } } },
        });
        for (const product of products) {
            const bad = product.images.some((u) => u.includes(PLACEHOLDER)) || product.variants.some((v) => v.images.some((u) => u.includes(PLACEHOLDER)));
            if (!bad) {
                console.log(`= ${spec.product.name} (${product.id}): images already fine`);
                continue;
            }
            changed++;
            if (!APPLY) {
                console.log(`✗ ${spec.product.name} (${product.id}): has placeholder images, will be fixed`);
                continue;
            }
            const url = await uploadImage(spec.image);
            const swap = (urls: string[]) => urls.map((u) => (u.includes(PLACEHOLDER) ? url : u));
            await prisma.$transaction([
                prisma.product.update({ where: { id: product.id }, data: { images: swap(product.images) } }),
                ...product.variants
                    .filter((v) => v.images.some((u) => u.includes(PLACEHOLDER)))
                    .map((v) => prisma.productVariant.update({ where: { id: v.id }, data: { images: swap(v.images) } })),
            ]);
            await invalidateProductCaches(product.id);
            console.log(`✓ ${spec.product.name} (${product.id}): image set to ${url}`);
        }
    }
    console.log(APPLY ? '\nDone.' : `\nDry run: ${changed} product(s) to fix. Re-run with --fix-images --apply.`);
}

async function main() {
    console.log(`Database: ${databaseHost()}${IS_LOCAL_DB ? ' (local)' : ' (NOT local)'}`);
    if (SKIP_UPLOAD && !IS_LOCAL_DB) {
        throw new Error('--skip-upload uses placeholder images and is only allowed on a local database');
    }
    const sellers = await prisma.user.findMany({ where: { role: 'SELLER' }, select: { id: true, email: true, status: true } });
    if (sellers.length !== 1) {
        throw new Error(`Expected exactly one seller account, found ${sellers.length}: ${sellers.map((s) => s.email).join(', ') || '(none)'}`);
    }
    const seller = sellers[0]!;
    const admin = await prisma.user.findFirst({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isEmployee: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true },
    });
    if (!admin) throw new Error('No admin account found to record the approval');
    if (FIX_IMAGES) return fixImages(seller.id);
    console.log(`Seller: ${seller.email} (${seller.status})\nApproved as admin: ${admin.email}\nMode: ${APPLY ? 'APPLY' : 'DRY RUN (nothing written)'}\n`);

    const cats: Cat[] = await prisma.category.findMany({ select: { id: true, name: true, parentId: true, isActive: true } });
    const byId = new Map(cats.map((c) => [c.id, c]));
    const hasChildren = new Set(cats.filter((c) => c.parentId && c.isActive).map((c) => c.parentId!));

    const plan: { spec: Spec; categoryId: string; attributes: Record<string, string> }[] = [];
    let problems = 0;
    for (const spec of SPECS) {
        const p = spec.product;
        const picked = pickCategory(spec, cats, byId, hasChildren);
        if (!picked) {
            console.log(`✗ ${p.name}\n    no matching category (looked for: ${spec.categoryNames.join(', ')})`);
            problems++;
            continue;
        }
        const { attributes, missing } = await applyCategoryFields(picked.cat.id, p.attributes);
        const existing = await prisma.product.findFirst({ where: { sellerId: seller.id, title: p.name, deletedByAdmin: false }, select: { id: true } });
        console.log(`${missing.length ? '✗' : existing ? '=' : '✓'} ${p.name}`);
        console.log(`    category: ${picked.path}${hasChildren.has(picked.cat.id) ? '  (has sub-categories)' : ''}`);
        console.log(`    sizes:    ${p.sizes.map((s) => `${s.size} ₹${s.sellerPrice} (MRP ₹${s.mrp}) ×${s.stock}`).join(', ')}`);
        if (existing) console.log('    already listed by this seller: will be skipped');
        if (missing.length) {
            console.log(`    missing required category fields: ${missing.join(', ')}`);
            problems++;
            continue;
        }
        if (!existing) plan.push({ spec, categoryId: picked.cat.id, attributes });
    }

    if (problems) throw new Error(`${problems} product(s) need attention (see above). Nothing was written.`);
    if (!APPLY) {
        console.log(`\nDry run OK: ${plan.length} product(s) would be created and published. Re-run with --apply.`);
        return;
    }

    for (const { spec, categoryId, attributes } of plan) {
        const url = await uploadImage(spec.image);
        const res = await sellerCatalogUploadsService.submitSingle(seller.id, {
            categoryId,
            products: [{ ...spec.product, attributes, images: [url] }],
        });
        if (res.errors.length) throw new Error(`${spec.product.name}: ${res.errors.map((e) => e.message).join('; ')}`);
        for (const created of res.products) {
            await adminService.approveProduct(created.id, admin.id);
            const product = await prisma.product.findUnique({ where: { id: created.id }, select: { slug: true, isPublished: true, status: true } });
            console.log(`✓ ${created.title}\n    id ${created.id} · ${product?.status} · ${product?.isPublished ? 'published' : 'NOT published'} · /product/${product?.slug ?? created.id}`);
        }
    }
    console.log('\nDone.');
}

main()
    .catch((err) => {
        console.error(`\nFailed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        // Queues/Redis clients opened by services keep the process alive.
        setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
    });
