/**
 * Simulate Commission Race
 *
 * Tests:
 * 1. Trigger calculateAndStoreSellerSettlement twice concurrently → only one set of rows
 * 2. Verify totals are correct (commission, gross, net)
 * 3. No duplicate settlement rows
 */

import { OrderStatus, PaymentProvider, PaymentStatus, ProductStatus, Role, UserStatus, SettlementStatus } from '@prisma/client';
import { prisma } from './test-utils.js';
import { commissionService } from '../src/services/commission.service.js';

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
    console.log('\n🏁 Commission Race Simulation\n');

    // ── Setup ──────────────────────────────────────────────────────

    console.log('  Setting up test data...');

    const seller1 = await prisma.user.create({
        data: {
            email: `com-seller1-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.SELLER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    const seller2 = await prisma.user.create({
        data: {
            email: `com-seller2-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.SELLER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    const buyer = await prisma.user.create({
        data: {
            email: `com-buyer-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.USER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    const category = await prisma.category.create({
        data: {
            name: `Commission Race Cat ${now}`,
            slug: `commission-race-cat-${now}`,
            isActive: true,
        },
    });

    const product1 = await prisma.product.create({
        data: {
            sellerId: seller1.id,
            categoryId: category.id,
            title: `Commission Product 1 ${now}`,
            description: 'Test product 1',
            sellerPrice: 400,
            adminListingPrice: 800,
            status: ProductStatus.APPROVED,
            isPublished: true,
            deletedByAdmin: false,
            images: [],
        },
    });

    const variant1 = await prisma.productVariant.create({
        data: {
            productId: product1.id,
            size: 'Default',
            sku: `COM-RACE-1-${now}`,
            sellerPrice: 400,
            adminListingPrice: 800,
            price: 800,
            compareAtPrice: 1000,
            status: ProductStatus.APPROVED,
            inventory: { create: { stock: 10 } },
        },
    });

    const product2 = await prisma.product.create({
        data: {
            sellerId: seller2.id,
            categoryId: category.id,
            title: `Commission Product 2 ${now}`,
            description: 'Test product 2',
            sellerPrice: 600,
            adminListingPrice: 1200,
            status: ProductStatus.APPROVED,
            isPublished: true,
            deletedByAdmin: false,
            images: [],
        },
    });

    const variant2 = await prisma.productVariant.create({
        data: {
            productId: product2.id,
            size: 'Default',
            sku: `COM-RACE-2-${now}`,
            sellerPrice: 600,
            adminListingPrice: 1200,
            price: 1200,
            compareAtPrice: 1500,
            status: ProductStatus.APPROVED,
            inventory: { create: { stock: 10 } },
        },
    });

    // Configure seller1 with 15% commission + ₹50 platform fee
    await prisma.sellerCommissionConfig.create({
        data: {
            sellerId: seller1.id,
            commissionPct: 15,
            platformFee: 50,
        },
    });

    // seller2 has NO config — should use defaults (10%, ₹0)

    // Order: 2 items from different sellers
    // seller1 item: 800 * 1 = 800
    // seller2 item: 1200 * 1 = 1200
    // total: 2000
    const order = await prisma.order.create({
        data: {
            userId: buyer.id,
            status: OrderStatus.CONFIRMED,
            totalAmount: 2000,
            subTotalAmount: 2000,
            totalTaxAmount: 0,
            grandTotal: 2000,
            items: {
                create: [
                    {
                        sellerId: seller1.id,
                        productId: product1.id,
                        variantId: variant1.id,
                        quantity: 1,
                        priceSnapshot: 800,
                        sellerPriceSnapshot: 400,
                        adminPriceSnapshot: 800,
                        platformMargin: 400,
                        taxRate: 0,
                        taxableAmount: 800,
                        cgstAmount: 0,
                        sgstAmount: 0,
                        igstAmount: 0,
                        totalAmount: 800,
                    },
                    {
                        sellerId: seller2.id,
                        productId: product2.id,
                        variantId: variant2.id,
                        quantity: 1,
                        priceSnapshot: 1200,
                        sellerPriceSnapshot: 600,
                        adminPriceSnapshot: 1200,
                        platformMargin: 600,
                        taxRate: 0,
                        taxableAmount: 1200,
                        cgstAmount: 0,
                        sgstAmount: 0,
                        igstAmount: 0,
                        totalAmount: 1200,
                    },
                ],
            },
        },
    });

    await prisma.payment.create({
        data: {
            orderId: order.id,
            userId: buyer.id,
            amount: 2000,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: PaymentProvider.MOCK,
        },
    });

    console.log(`  Order: ${order.id}, totalAmount: 2000 INR`);
    console.log(`  Seller1 (15% + ₹50 fee): item = ₹800`);
    console.log(`  Seller2 (default 10%):    item = ₹1200\n`);

    // ── Scenario 1: Concurrent settlement calls ───────────────────

    console.log('  ▸ Scenario 1: 3 concurrent settlement calls (only 1 set should persist)');

    const results = await Promise.allSettled([
        (async () => {
            await randomDelay(10);
            return commissionService.calculateAndStoreSellerSettlement(order.id);
        })(),
        (async () => {
            await randomDelay(10);
            return commissionService.calculateAndStoreSellerSettlement(order.id);
        })(),
        (async () => {
            await randomDelay(10);
            return commissionService.calculateAndStoreSellerSettlement(order.id);
        })(),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;
    console.log(`    Fulfilled: ${fulfilled}, Rejected: ${rejected}`);

    assert(fulfilled >= 1, 'At least one concurrent settlement call should succeed');

    // ── Verify DB state ───────────────────────────────────────────

    const settlements = await prisma.sellerSettlement.findMany({
        where: { orderId: order.id },
        orderBy: { sellerId: 'asc' },
    });

    console.log(`    Settlement rows: ${settlements.length}`);
    assert(settlements.length === 2, `Expected 2 settlement rows (one per seller), got ${settlements.length}`);
    console.log('    ✅ Exactly 2 settlements (no duplicates)');

    // ── Scenario 2: Verify commission math ────────────────────────

    console.log('\n  ▸ Scenario 2: Verify commission calculations');

    const s1 = settlements.find((s) => s.sellerId === seller1.id)!;
    const s2 = settlements.find((s) => s.sellerId === seller2.id)!;

    // Seller1: gross=800, commission=800*15/100=120, platformFee=50, net=800-120-50=630
    console.log(`    Seller1: gross=${s1.grossAmount}, commission=${s1.commissionAmount}, fee=${s1.platformFee}, net=${s1.netAmount}`);
    assert(s1.grossAmount === 800, `Seller1 gross expected 800, got ${s1.grossAmount}`);
    assert(s1.commissionAmount === 120, `Seller1 commission expected 120, got ${s1.commissionAmount}`);
    assert(s1.platformFee === 50, `Seller1 platformFee expected 50, got ${s1.platformFee}`);
    assert(s1.netAmount === 630, `Seller1 net expected 630, got ${s1.netAmount}`);
    console.log('    ✅ Seller1 math correct');

    // Seller2: gross=1200, commission=1200*10/100=120, platformFee=0, net=1200-120-0=1080
    console.log(`    Seller2: gross=${s2.grossAmount}, commission=${s2.commissionAmount}, fee=${s2.platformFee}, net=${s2.netAmount}`);
    assert(s2.grossAmount === 1200, `Seller2 gross expected 1200, got ${s2.grossAmount}`);
    assert(s2.commissionAmount === 120, `Seller2 commission expected 120, got ${s2.commissionAmount}`);
    assert(s2.platformFee === 0, `Seller2 platformFee expected 0, got ${s2.platformFee}`);
    assert(s2.netAmount === 1080, `Seller2 net expected 1080, got ${s2.netAmount}`);
    console.log('    ✅ Seller2 math correct');

    // Both should be PENDING
    assert(s1.status === SettlementStatus.PENDING, 'Seller1 status should be PENDING');
    assert(s2.status === SettlementStatus.PENDING, 'Seller2 status should be PENDING');
    console.log('    ✅ Both settlements are PENDING');

    // ── Scenario 3: Second order same sellers ─────────────────────

    console.log('\n  ▸ Scenario 3: Second order — independent settlement');

    const order2 = await prisma.order.create({
        data: {
            userId: buyer.id,
            status: OrderStatus.CONFIRMED,
            totalAmount: 800,
            subTotalAmount: 800,
            totalTaxAmount: 0,
            grandTotal: 800,
            items: {
                create: [
                    {
                        sellerId: seller1.id,
                        productId: product1.id,
                        variantId: variant1.id,
                        quantity: 1,
                        priceSnapshot: 800,
                        sellerPriceSnapshot: 400,
                        adminPriceSnapshot: 800,
                        platformMargin: 400,
                        taxRate: 0,
                        taxableAmount: 800,
                        cgstAmount: 0,
                        sgstAmount: 0,
                        igstAmount: 0,
                        totalAmount: 800,
                    },
                ],
            },
        },
    });

    await prisma.payment.create({
        data: {
            orderId: order2.id,
            userId: buyer.id,
            amount: 800,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: PaymentProvider.MOCK,
        },
    });

    await commissionService.calculateAndStoreSellerSettlement(order2.id);

    const order2Settlements = await prisma.sellerSettlement.findMany({
        where: { orderId: order2.id },
    });

    assert(order2Settlements.length === 1, `Expected 1 settlement for order2, got ${order2Settlements.length}`);
    assert(order2Settlements[0]!.grossAmount === 800, 'Order2 gross should be 800');
    console.log(`    Order2 settlement: gross=${order2Settlements[0]!.grossAmount}, net=${order2Settlements[0]!.netAmount}`);
    console.log('    ✅ Independent settlement created correctly');

    // ── Scenario 4: Payment not SUCCESS → skip ────────────────────

    console.log('\n  ▸ Scenario 4: Order with non-SUCCESS payment → skip');

    const order3 = await prisma.order.create({
        data: {
            userId: buyer.id,
            status: OrderStatus.PLACED,
            totalAmount: 500,
            subTotalAmount: 500,
            totalTaxAmount: 0,
            grandTotal: 500,
            items: {
                create: [
                    {
                        sellerId: seller1.id,
                        productId: product1.id,
                        variantId: variant1.id,
                        quantity: 1,
                        priceSnapshot: 500,
                        sellerPriceSnapshot: 250,
                        adminPriceSnapshot: 500,
                        platformMargin: 250,
                        totalAmount: 500,
                    },
                ],
            },
        },
    });

    await prisma.payment.create({
        data: {
            orderId: order3.id,
            userId: buyer.id,
            amount: 500,
            currency: 'INR',
            status: PaymentStatus.INITIATED,
            provider: PaymentProvider.MOCK,
        },
    });

    await commissionService.calculateAndStoreSellerSettlement(order3.id);

    const order3Settlements = await prisma.sellerSettlement.findMany({
        where: { orderId: order3.id },
    });

    assert(order3Settlements.length === 0, 'No settlements should be created for non-SUCCESS payment');
    console.log('    ✅ Correctly skipped (payment not SUCCESS)');

    // ── Summary ───────────────────────────────────────────────────

    console.log('\n✅ All commission race simulation assertions passed!\n');

    // Cleanup
    const orderIds = [order.id, order2.id, order3.id];
    await prisma.sellerSettlement.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.sellerCommissionConfig.deleteMany({ where: { sellerId: { in: [seller1.id, seller2.id] } } });
    await prisma.inventory.deleteMany({ where: { variantId: { in: [variant1.id, variant2.id] } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: [product1.id, product2.id] } } });
    await prisma.product.deleteMany({ where: { id: { in: [product1.id, product2.id] } } });
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.user.deleteMany({ where: { id: { in: [seller1.id, seller2.id, buyer.id] } } });

    console.log('  Cleanup complete.\n');
}

run()
    .catch((err) => {
        console.error('❌ Simulation failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
