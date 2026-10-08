/**
 * Concurrent Checkout Load Simulation
 *
 * Proves inventory hard-locking works under high concurrency:
 *   1. Creates a product with a single variant (stock = STOCK_LIMIT).
 *   2. Creates CONCURRENT_USERS unique buyer accounts, each with the item in cart.
 *   3. Fires all CONCURRENT_USERS checkouts simultaneously via Promise.allSettled.
 *   4. Asserts:
 *        - Exactly STOCK_LIMIT succeed (HTTP 201).
 *        - Remaining fail with 409 (out of stock).
 *        - Final DB stock === 0 (never negative).
 *        - InventoryMovements of type RESERVE === STOCK_LIMIT.
 *
 * Usage:  npx tsx scripts/simulate-checkout.ts
 * Requires: backend server running on PORT (default 4000)
 */
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import { generateAccessToken } from '../src/utils/jwt.util.js';
import { env } from '../src/config/env.js';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();
const BASE_URL = `http://localhost:${env.PORT}`;
// ------------------------------------------------------------------
// Tunables
// ------------------------------------------------------------------
const STOCK_LIMIT = 5;
const CONCURRENT_USERS = 50;
// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const COLORS = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
    gray: '\x1b[90m',
    bold: '\x1b[1m',
};
function log(icon, msg) {
    console.log(`${icon} ${msg}`);
}
async function api(path, method, body, token) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}
async function createUser(suffix) {
    const email = `sim-buyer-${suffix}-${Date.now()}@test.com`;
    const passwordHash = await bcrypt.hash('Password123!', 4); // fast rounds for test
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            role: Role.USER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });
    const token = generateAccessToken({
        userId: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
    });
    return { id: user.id, token };
}
// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
    console.log(`\n${COLORS.bold}╔══════════════════════════════════════════════════╗${COLORS.reset}`);
    console.log(`${COLORS.bold}║   Concurrent Checkout Load Simulation            ║${COLORS.reset}`);
    console.log(`${COLORS.bold}║   Stock: ${STOCK_LIMIT}  |  Users: ${CONCURRENT_USERS}                       ║${COLORS.reset}`);
    console.log(`${COLORS.bold}╚══════════════════════════════════════════════════╝${COLORS.reset}\n`);
    // ── Step 1: Create seller + product + variant ──────────────────
    log('🔧', 'Setting up seller, product, variant...');
    const sellerEmail = `sim-seller-${Date.now()}@test.com`;
    const sellerHash = await bcrypt.hash('Password123!', 4);
    const seller = await prisma.user.create({
        data: {
            email: sellerEmail,
            passwordHash: sellerHash,
            role: Role.SELLER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });
    const sellerToken = generateAccessToken({
        userId: seller.id,
        email: seller.email,
        phone: seller.phone,
        role: seller.role,
        status: seller.status,
        isEmailVerified: seller.isEmailVerified,
        isPhoneVerified: seller.isPhoneVerified,
    });
    // Get a category
    const catRes = await api('/v1/categories', 'GET', null, sellerToken);
    const categoryId = catRes.data.categories?.[0]?.id;
    if (!categoryId)
        throw new Error('No categories found — seed the DB first');
    // Create product
    const prodRes = await api('/v1/seller/products', 'POST', {
        categoryId,
        title: `Sim Load Test ${Date.now()}`,
        description: 'Concurrency simulation product',
        isPublished: true,
    }, sellerToken);
    const productId = prodRes.data.product?.id;
    if (!productId)
        throw new Error(`Failed to create product: ${JSON.stringify(prodRes.data)}`);
    // Create variant
    const varRes = await api(`/v1/seller/products/${productId}/variants`, 'POST', {
        sku: `SIM-${Date.now()}`,
        price: 100,
        compareAtPrice: 150,
        initialStock: STOCK_LIMIT,
    }, sellerToken);
    const variantId = varRes.data.variant?.id;
    if (!variantId)
        throw new Error(`Failed to create variant: ${JSON.stringify(varRes.data)}`);
    // Set stock explicitly
    await api(`/v1/seller/products/variants/${variantId}/stock`, 'PUT', { stock: STOCK_LIMIT }, sellerToken);
    // Admin approve + set price
    const adminEmail = `sim-admin-${Date.now()}@test.com`;
    const admin = await prisma.user.create({
        data: {
            email: adminEmail,
            passwordHash: sellerHash,
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });
    const adminToken = generateAccessToken({
        userId: admin.id,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        status: admin.status,
        isEmailVerified: admin.isEmailVerified,
        isPhoneVerified: admin.isPhoneVerified,
    });
    await api(`/v1/admin/products/${productId}/approve`, 'PUT', {}, adminToken);
    await api(`/v1/admin/products/${productId}/set-price`, 'PATCH', { adminListingPrice: 120 }, adminToken);
    log('✅', `Product ${productId}, Variant ${variantId}, Stock = ${STOCK_LIMIT}`);
    // ── Step 2: Create buyer accounts + add item to carts ──────────
    log('🔧', `Creating ${CONCURRENT_USERS} buyers and filling carts...`);
    const buyers = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
        const buyer = await createUser(i);
        buyers.push(buyer);
        // Add to cart
        await api('/v1/cart/items', 'POST', {
            productId,
            variantId,
            quantity: 1,
        }, buyer.token);
    }
    log('✅', `${CONCURRENT_USERS} buyers ready, all carts loaded`);
    // ── Step 3: Fire all checkouts concurrently ────────────────────
    log('🚀', `Firing ${CONCURRENT_USERS} concurrent checkouts NOW...`);
    const start = Date.now();
    const results = await Promise.allSettled(buyers.map((buyer) => api('/v1/checkout', 'POST', {}, buyer.token)));
    const elapsed = Date.now() - start;
    log('⏱️ ', `All ${CONCURRENT_USERS} requests completed in ${elapsed}ms`);
    // ── Step 4: Analyse results ────────────────────────────────────
    let successes = 0;
    let conflicts = 0;
    let otherErrors = 0;
    const statusCounts = new Map();
    for (const r of results) {
        if (r.status === 'fulfilled') {
            const s = r.value.status;
            statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
            if (s === 201)
                successes++;
            else if (s === 409)
                conflicts++;
            else
                otherErrors++;
        }
        else {
            otherErrors++;
        }
    }
    console.log(`\n${COLORS.bold}── Results ──${COLORS.reset}`);
    console.log(`  HTTP 201 (success)  : ${successes}`);
    console.log(`  HTTP 409 (conflict) : ${conflicts}`);
    console.log(`  Other errors        : ${otherErrors}`);
    for (const [status, count] of statusCounts) {
        if (status !== 201 && status !== 409) {
            console.log(`    HTTP ${status}: ${count}`);
        }
    }
    // ── Step 5: Verify database state ──────────────────────────────
    const inventory = await prisma.inventory.findUnique({ where: { variantId } });
    const finalStock = inventory?.stock ?? -999;
    const reserveCount = await prisma.inventoryMovement.count({
        where: { variantId, type: 'RESERVE' },
    });
    const releaseCount = await prisma.inventoryMovement.count({
        where: { variantId, type: 'RELEASE' },
    });
    // Count total orders created for this variant
    const ordersCreated = await prisma.orderItem.count({
        where: { variantId },
    });
    console.log(`\n${COLORS.bold}── Database State ──${COLORS.reset}`);
    console.log(`  Final stock         : ${finalStock}`);
    console.log(`  RESERVE movements   : ${reserveCount}`);
    console.log(`  RELEASE movements   : ${releaseCount}`);
    console.log(`  Net reserved        : ${reserveCount - releaseCount}`);
    console.log(`  Orders created      : ${ordersCreated}`);
    // ── Step 5b: Metrics Printout ──────────────────────────────────
    const successRate = ((successes / CONCURRENT_USERS) * 100).toFixed(1);
    const conflictRate = ((conflicts / CONCURRENT_USERS) * 100).toFixed(1);
    const avgLatency = elapsed / CONCURRENT_USERS;
    console.log(`\n${COLORS.bold}── Metrics ──${COLORS.reset}`);
    console.log(`  Success rate        : ${COLORS.green}${successRate}%${COLORS.reset} (${successes}/${CONCURRENT_USERS})`);
    console.log(`  Conflict rate       : ${COLORS.yellow}${conflictRate}%${COLORS.reset} (${conflicts}/${CONCURRENT_USERS})`);
    console.log(`  Total elapsed       : ${elapsed}ms`);
    console.log(`  Avg latency/req     : ${avgLatency.toFixed(1)}ms`);
    console.log(`  Throughput          : ${(CONCURRENT_USERS / (elapsed / 1000)).toFixed(1)} req/s`);
    // ── Step 6: Assertions ─────────────────────────────────────────
    console.log(`\n${COLORS.bold}── Assertions ──${COLORS.reset}`);
    let allPassed = true;
    function assert(label, condition, detail) {
        if (condition) {
            console.log(`  ${COLORS.green}✅ ${label}${COLORS.reset}`);
        }
        else {
            console.log(`  ${COLORS.red}❌ ${label} — ${detail}${COLORS.reset}`);
            allPassed = false;
        }
    }
    assert(`Exactly ${STOCK_LIMIT} succeed`, successes === STOCK_LIMIT, `expected ${STOCK_LIMIT}, got ${successes}`);
    assert(`Exactly ${CONCURRENT_USERS - STOCK_LIMIT} conflict (409)`, conflicts === CONCURRENT_USERS - STOCK_LIMIT, `expected ${CONCURRENT_USERS - STOCK_LIMIT}, got ${conflicts}`);
    assert('Final stock === 0', finalStock === 0, `expected 0, got ${finalStock}`);
    assert('Stock never negative', finalStock >= 0, `stock went to ${finalStock}`);
    assert(`RESERVE movements === ${STOCK_LIMIT}`, reserveCount === STOCK_LIMIT, `expected ${STOCK_LIMIT}, got ${reserveCount}`);
    assert('RELEASE movements === 0 (no cancellations yet)', releaseCount === 0, `expected 0, got ${releaseCount}`);
    assert(`Orders created === ${STOCK_LIMIT}`, ordersCreated === STOCK_LIMIT, `expected ${STOCK_LIMIT}, got ${ordersCreated}`);
    assert('Total movements match orders', reserveCount === ordersCreated, `RESERVE=${reserveCount} vs orders=${ordersCreated}`);
    assert('No unexpected errors', otherErrors === 0, `got ${otherErrors} unexpected errors`);
    assert(`Success rate is exactly ${((STOCK_LIMIT / CONCURRENT_USERS) * 100).toFixed(1)}%`, successes === STOCK_LIMIT, `got ${successRate}%`);
    console.log('');
    if (allPassed) {
        console.log(`${COLORS.green}${COLORS.bold}🎉 ALL ASSERTIONS PASSED — inventory locking is concurrency-safe!${COLORS.reset}\n`);
    }
    else {
        console.log(`${COLORS.red}${COLORS.bold}💥 SOME ASSERTIONS FAILED — review output above.${COLORS.reset}\n`);
        process.exitCode = 1;
    }
}
main()
    .catch((err) => {
    console.error('Fatal error:', err);
    process.exitCode = 2;
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=simulate-checkout.js.map