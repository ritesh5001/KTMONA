import { logger } from '../config/logger.js';
import { productService } from './product.service.js';
import { categoryService } from './category.service.js';
import { occasionService } from './occasion.service.js';
import { bestsellerService } from './bestseller.service.js';
import { getPhonePeAccessToken, isPhonePeConfigured } from './phonepe.client.js';
import { settingsService } from './settings.service.js';
import { searchService } from './search.service.js';
const log = logger.child({ module: 'catalog-warmup' });
/**
 * Pre-populate the Redis cache for the storefront's hot reads.
 *
 * Why this exists: the API, Postgres and Redis are all in different places, so a
 * cache HIT costs ~60ms while a MISS costs seconds (one Redis round-trip, three
 * Postgres statements, then a Redis write — each a separate network hop). Warm,
 * the storefront endpoints answer in 60-90ms; cold they take 2-6s.
 *
 * Without this, every deploy empties the cache and the next real visitor pays that
 * cost on every endpoint the homepage touches. Warming on boot and just often
 * enough to stay ahead of expiry means a shopper should essentially never be the
 * one who refills the cache.
 *
 * Entirely best-effort: warming is an optimisation, never a reason to fail boot or
 * take the process down.
 */
/** The exact reads the homepage and marketplace pages perform. */
function warmupTasks() {
    return [
        // Read by every checkout. Warming them keeps the in-memory settings cache
        // refreshed ahead of expiry so a buyer never pays for it mid-order.
        { name: 'settings:shipping', run: () => settingsService.getShippingFee(true) },
        { name: 'settings:gst', run: () => settingsService.isGstChargeEnabled() },
        { name: 'categories', run: () => categoryService.listCategories() },
        { name: 'occasions', run: () => occasionService.listOccasions() },
        { name: 'bestsellers:MENS', run: () => bestsellerService.listPublic(4, 'MENS') },
        { name: 'bestsellers:KIDS', run: () => bestsellerService.listPublic(4, 'KIDS') },
        // These must mirror the page requests EXACTLY. The cache key includes page,
        // limit and every filter, so warming limit=20 does nothing for a page that
        // asks for limit=9 — it just silently misses and pays the cold read.
        //
        //   limit 20 -> shared PRODUCTS_LIST key (API default)
        //   limit  9 -> /marketplace  (shop page, first page unfiltered)
        //   limit 10 -> homepage rails, per audience
        { name: 'products:default', run: () => productService.listProducts({ page: 1, limit: 20 }) },
        { name: 'products:marketplace', run: () => productService.listProducts({ page: 1, limit: 9 }) },
        { name: 'products:MENS', run: () => productService.listProducts({ page: 1, limit: 10, audience: 'MENS' }) },
        { name: 'products:KIDS', run: () => productService.listProducts({ page: 1, limit: 10, audience: 'KIDS' }) },
    ];
}
/**
 * How many product detail pages to keep warm. These are the products actually
 * reachable from the homepage and the first marketplace page, which is where
 * essentially all product clicks start. Warming the entire catalogue would be
 * wasted work on items nobody opens.
 */
const WARM_PRODUCT_DETAIL_LIMIT = 24;
/**
 * How many warmup reads may be in flight at once. Kept well under the Prisma
 * connection limit so background warming never competes with live traffic.
 */
const WARM_CONCURRENCY = 4;
/** Warm detail pages for the products a shopper is most likely to click into. */
async function warmVisibleProductDetails() {
    const listing = (await productService.listProducts({ page: 1, limit: 20 }));
    const ids = (listing.data ?? [])
        .map((product) => product.id)
        .filter((id) => Boolean(id))
        .slice(0, WARM_PRODUCT_DETAIL_LIMIT);
    if (ids.length === 0)
        return 0;
    // Warm the detail page AND its "You may also like" rail. Related products are
    // cached per product id, so with a catalogue this size almost every product page
    // was a cache miss — the rail is one of the last things to appear on the page.
    //
    // Run these a few at a time rather than all at once. Firing every product's
    // detail + rail concurrently exhausted the Prisma connection pool ("Timed out
    // fetching a new connection", limit 20) and would have starved real requests
    // during warmup. Warming is background work; it must never crowd out a shopper.
    const jobs = ids.flatMap((id) => [
        () => productService.getProductById(id),
        () => searchService.getRelatedProducts(id, 4),
    ]);
    let warmed = 0;
    const queue = [...jobs];
    const workers = Array.from({ length: WARM_CONCURRENCY }, async () => {
        while (queue.length > 0) {
            const job = queue.shift();
            if (!job)
                return;
            try {
                await job();
                warmed += 1;
            }
            catch {
                // Best-effort: a single cold entry is not worth failing the sweep.
            }
        }
    });
    await Promise.all(workers);
    return warmed;
}
/**
 * Fetch (and cache) the PhonePe OAuth token ahead of time.
 *
 * The token is cached in-process until shortly before it expires, but it is fetched
 * lazily — so after every deploy or restart the first buyer to press Place Order
 * paid an extra round-trip to PhonePe's identity service while waiting on the
 * checkout they had already committed to. Doing it here moves that cost off the
 * critical path entirely.
 */
async function warmPhonePeToken() {
    if (!isPhonePeConfigured())
        return false;
    try {
        await getPhonePeAccessToken();
        return true;
    }
    catch (err) {
        // Never fatal: a failure here just means the first checkout refetches it,
        // which is exactly the old behaviour.
        log.warn({ event: 'phonepe_token_warmup_failed', err }, 'PhonePe token warmup failed');
        return false;
    }
}
export async function warmCatalogCaches(trigger) {
    const started = Date.now();
    const tasks = warmupTasks();
    // Independent of the catalog reads, so let it run alongside them.
    const phonepeTokenWarm = warmPhonePeToken();
    // Run concurrently: these are independent reads, and serialising them would
    // multiply the cross-region round-trip cost for no benefit.
    const results = await Promise.allSettled(tasks.map((task) => task.run()));
    // Detail pages depend on the listing, so they run after it.
    let warmedDetails = 0;
    try {
        warmedDetails = await warmVisibleProductDetails();
    }
    catch (err) {
        log.warn({ event: 'catalog_warmup_details_failed', err }, 'Product detail warmup failed');
    }
    const tokenWarmed = await phonepeTokenWarm;
    const failed = results
        .map((result, index) => ({ result, name: tasks[index].name }))
        .filter((entry) => entry.result.status === 'rejected');
    if (failed.length > 0) {
        log.warn({
            event: 'catalog_warmup_partial',
            trigger,
            failed: failed.map((entry) => entry.name),
            durationMs: Date.now() - started,
        }, `Catalog warmup: ${tasks.length - failed.length}/${tasks.length} succeeded`);
        return;
    }
    log.info({
        event: 'catalog_warmup_ok',
        trigger,
        warmed: tasks.length,
        warmedDetails,
        phonepeToken: tokenWarmed,
        durationMs: Date.now() - started,
    }, `Catalog cache warmed (${tasks.length} listings + ${warmedDetails} product pages${tokenWarmed ? ' + PhonePe token' : ''} in ${Date.now() - started}ms)`);
}
//# sourceMappingURL=catalog-warmup.service.js.map