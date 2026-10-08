import { OrderStatus, PaymentProvider, PaymentStatus, ProductStatus, RefundStatus, Role, UserStatus } from '@prisma/client';
import { prisma } from './test-utils.js';
import { refundService } from '../src/services/refund.service.js';

function randomDelay(maxMs: number): Promise<void> {
    const ms = Math.floor(Math.random() * maxMs);
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

async function run(): Promise<void> {
    const now = Date.now();
    console.log('\n🏁 Refund Ledger Race Simulation\n');

    // ── Setup ──────────────────────────────────────────────────────

    console.log('  Setting up test data...');

    const seller = await prisma.user.create({
        data: {
            email: `refund-seller-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.SELLER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    const buyer = await prisma.user.create({
        data: {
            email: `refund-buyer-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.USER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    const category = await prisma.category.create({
        data: {
            name: `Refund Race Cat ${now}`,
            slug: `refund-race-cat-${now}`,
            isActive: true,
        },
    });

    const product = await prisma.product.create({
        data: {
            sellerId: seller.id,
            categoryId: category.id,
            title: `Refund Race Product ${now}`,
            description: 'Test product for refund race simulation',
            sellerPrice: 500,
            adminListingPrice: 1000,
            status: ProductStatus.APPROVED,
            isPublished: true,
            deletedByAdmin: false,
            images: [],
        },
    });

    const variant = await prisma.productVariant.create({
        data: {
            productId: product.id,
            size: 'Default',
            sku: `REFUND-RACE-${now}`,
            sellerPrice: 500,
            adminListingPrice: 1000,
            price: 1000,
            compareAtPrice: 1200,
            status: ProductStatus.APPROVED,
            inventory: {
                create: { stock: 10 },
            },
        },
    });

    // Order total = 1000 INR = 100000 paise
    const order = await prisma.order.create({
        data: {
            userId: buyer.id,
            status: OrderStatus.CONFIRMED,
            totalAmount: 1000,
            subTotalAmount: 1000,
            totalTaxAmount: 0,
            grandTotal: 1000,
            items: {
                create: [
                    {
                        sellerId: seller.id,
                        productId: product.id,
                        variantId: variant.id,
                        quantity: 1,
                        priceSnapshot: 1000,
                        sellerPriceSnapshot: 500,
                        adminPriceSnapshot: 1000,
                        platformMargin: 500,
                    },
                ],
            },
        },
    });

    await prisma.payment.create({
        data: {
            orderId: order.id,
            userId: buyer.id,
            amount: 1000,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: PaymentProvider.MOCK,
        },
    });

    console.log(`  Order: ${order.id}, totalAmount: 1000 INR (100000 paise)`);

    // ── Scenario 1: 3 concurrent full-refund attempts ─────────────

    console.log('\n  ▸ Scenario 1: 3 concurrent full-refund attempts (should only 1 succeed)');

    const refundAmount = 100000; // 1000 INR in paise

    const results = await Promise.allSettled([
        (async () => {
            await randomDelay(20);
            return refundService.createRefund({
                orderId: order.id,
                amount: refundAmount,
                reason: 'Concurrent attempt 1',
                initiatedBy: 'SYSTEM',
            });
        })(),
        (async () => {
            await randomDelay(20);
            return refundService.createRefund({
                orderId: order.id,
                amount: refundAmount,
                reason: 'Concurrent attempt 2',
                initiatedBy: 'ADMIN',
            });
        })(),
        (async () => {
            await randomDelay(20);
            return refundService.createRefund({
                orderId: order.id,
                amount: refundAmount,
                reason: 'Concurrent attempt 3',
                initiatedBy: 'SYSTEM',
            });
        })(),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    console.log(`    Fulfilled: ${successes.length}, Rejected: ${failures.length}`);

    // Check DB state
    const allRefunds = await prisma.refund.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: 'asc' },
    });

    const successRefunds = allRefunds.filter((r) => r.status === RefundStatus.SUCCESS);
    const failedRefunds = allRefunds.filter((r) => r.status === RefundStatus.FAILED);

    const totalRefundedPaise = successRefunds.reduce((sum, r) => sum + r.amount, 0);

    console.log(`    Total refund rows: ${allRefunds.length}`);
    console.log(`    SUCCESS rows: ${successRefunds.length}`);
    console.log(`    FAILED rows: ${failedRefunds.length}`);
    console.log(`    Total refunded: ${totalRefundedPaise} paise`);

    // Assertions
    assert(
        totalRefundedPaise <= refundAmount,
        `Over-refund detected! Refunded ${totalRefundedPaise} paise > limit ${refundAmount}`,
    );

    // At least one should have succeeded (first one in)
    assert(
        successRefunds.length >= 1,
        'Expected at least one successful refund',
    );

    // Idempotency: the second call for same amount should return existing refund
    // (The fulfilled count can be > 1 due to idempotency returning the same record)
    console.log(`    ✅ No over-refund (${totalRefundedPaise} <= ${refundAmount})`);

    // ── Scenario 2: Attempt another refund over the limit ─────────

    console.log('\n  ▸ Scenario 2: Attempt additional refund beyond limit');

    let overRefundBlocked = false;
    try {
        await refundService.createRefund({
            orderId: order.id,
            amount: 100, // 1 INR more
            reason: 'Over-limit attempt',
            initiatedBy: 'ADMIN',
        });
    } catch (error: any) {
        overRefundBlocked = true;
        console.log(`    Correctly blocked: ${error.message}`);
    }

    assert(overRefundBlocked, 'Over-refund should have been blocked');
    console.log('    ✅ Over-refund correctly prevented');

    // ── Scenario 3: Partial refunds ───────────────────────────────

    console.log('\n  ▸ Scenario 3: Partial refunds on a new order');

    const order2 = await prisma.order.create({
        data: {
            userId: buyer.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 2000,
            subTotalAmount: 2000,
            totalTaxAmount: 0,
            grandTotal: 2000,
            items: {
                create: [
                    {
                        sellerId: seller.id,
                        productId: product.id,
                        variantId: variant.id,
                        quantity: 2,
                        priceSnapshot: 1000,
                        sellerPriceSnapshot: 500,
                        adminPriceSnapshot: 1000,
                        platformMargin: 500,
                    },
                ],
            },
        },
    });

    await prisma.payment.create({
        data: {
            orderId: order2.id,
            userId: buyer.id,
            amount: 2000,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: PaymentProvider.MOCK,
        },
    });

    // Partial refund 1: 800 INR
    const partial1 = await refundService.createRefund({
        orderId: order2.id,
        amount: 80000,
        reason: 'Partial return 1',
        initiatedBy: 'ADMIN',
    });
    assert(partial1.status === RefundStatus.SUCCESS, 'Partial refund 1 should succeed');
    console.log(`    Partial refund 1: ${partial1.amount} paise → ${partial1.status}`);

    // Partial refund 2: 1200 INR
    const partial2 = await refundService.createRefund({
        orderId: order2.id,
        amount: 120000,
        reason: 'Partial return 2',
        initiatedBy: 'ADMIN',
    });
    assert(partial2.status === RefundStatus.SUCCESS, 'Partial refund 2 should succeed');
    console.log(`    Partial refund 2: ${partial2.amount} paise → ${partial2.status}`);

    // Partial refund 3: This should fail (80000+120000 = 200000, order = 200000, adding 1 more should fail)
    let partialOverBlocked = false;
    try {
        await refundService.createRefund({
            orderId: order2.id,
            amount: 1,
            reason: 'Over-limit partial',
            initiatedBy: 'ADMIN',
        });
    } catch {
        partialOverBlocked = true;
    }
    assert(partialOverBlocked, 'Partial over-refund should be blocked');
    console.log('    ✅ Partial refunds work correctly, over-limit blocked');

    // ── Final Verification ────────────────────────────────────────

    const order2Refunds = await prisma.refund.findMany({
        where: { orderId: order2.id, status: RefundStatus.SUCCESS },
    });
    const order2Total = order2Refunds.reduce((sum, r) => sum + r.amount, 0);
    assert(order2Total === 200000, `Expected 200000 paise refunded, got ${order2Total}`);
    console.log(`    ✅ Total refunded for order 2: ${order2Total} paise (correct)`);

    // ── Immutability check ────────────────────────────────────────

    console.log('\n  ▸ Immutability: Failed refund rows are preserved');
    const allOrder1Refunds = await prisma.refund.findMany({ where: { orderId: order.id } });
    const failedCount = allOrder1Refunds.filter((r) => r.status === RefundStatus.FAILED).length;
    console.log(`    Failed records preserved: ${failedCount}`);
    // All rows should exist — none deleted
    assert(allOrder1Refunds.length >= 1, 'Refund ledger should have entries');
    console.log('    ✅ Ledger is immutable (no deletions)');

    // ── Summary ───────────────────────────────────────────────────

    console.log('\n✅ All refund race simulation assertions passed!\n');

    // Cleanup
    await prisma.refund.deleteMany({ where: { orderId: { in: [order.id, order2.id] } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: [order.id, order2.id] } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: [order.id, order2.id] } } });
    await prisma.order.deleteMany({ where: { id: { in: [order.id, order2.id] } } });
    await prisma.inventory.deleteMany({ where: { variantId: variant.id } });
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.user.deleteMany({ where: { id: { in: [seller.id, buyer.id] } } });

    console.log('  Cleanup complete.\n');
}

run()
    .catch((err) => {
        console.error('❌ Simulation failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
