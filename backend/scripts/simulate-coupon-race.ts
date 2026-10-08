import { CouponType, OrderStatus, PaymentProvider, PaymentStatus, ProductStatus, Role, UserStatus } from '@prisma/client';
import { prisma } from './test-utils.js';
import { checkoutService } from '../src/services/checkout.service.js';
import { commissionService } from '../src/services/commission.service.js';

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}

async function addToCart(userId: string, productId: string, variantId: string, quantity: number) {
    const cart = await prisma.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
    });

    await prisma.cartItem.upsert({
        where: {
            cartId_variantId: {
                cartId: cart.id,
                variantId,
            },
        },
        update: {
            quantity: { increment: quantity },
            productId,
            priceSnapshot: 1000,
        },
        create: {
            cartId: cart.id,
            productId,
            variantId,
            quantity,
            priceSnapshot: 1000,
        },
    });
}

async function run(): Promise<void> {
    const now = Date.now();
    console.log('\n🏁 Coupon Race Simulation\n');

    const seller = await prisma.user.create({
        data: {
            email: `coupon-seller-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.SELLER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            state: 'Maharashtra',
        },
    });

    const buyerA = await prisma.user.create({
        data: {
            email: `coupon-buyera-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.USER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            state: 'Maharashtra',
        },
    });

    const buyerB = await prisma.user.create({
        data: {
            email: `coupon-buyerb-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.USER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            state: 'Maharashtra',
        },
    });

    await prisma.seller_profiles.create({
        data: {
            user_id: seller.id,
            store_name: `Coupon Seller ${now}`,
            store_slug: `coupon-seller-${now}`,
            business_type: 'INDIVIDUAL',
            state: 'Maharashtra',
            kyc_status: 'VERIFIED',
            updated_at: new Date(),
        },
    });

    const category = await prisma.category.create({
        data: {
            name: `Coupon Cat ${now}`,
            slug: `coupon-cat-${now}`,
            isActive: true,
        },
    });

    const product = await prisma.product.create({
        data: {
            sellerId: seller.id,
            categoryId: category.id,
            title: `Coupon Product ${now}`,
            description: 'Coupon race product',
            sellerPrice: 500,
            adminListingPrice: 1000,
            taxRate: 18,
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
            sku: `COUPON-RACE-${now}`,
            sellerPrice: 500,
            adminListingPrice: 1000,
            price: 1000,
            compareAtPrice: 1200,
            status: ProductStatus.APPROVED,
            inventory: { create: { stock: 20 } },
        },
    });

    // 1) Two users redeem last usage slot concurrently
    const oneSlotCoupon = await prisma.coupon.create({
        data: {
            code: `LASTSLOT${now}`,
            type: CouponType.FLAT,
            value: 100,
            usageLimit: 1,
            usedCount: 0,
            validFrom: new Date(Date.now() - 60_000),
            validUntil: new Date(Date.now() + 60 * 60 * 1000),
            isActive: true,
        },
    });

    await addToCart(buyerA.id, product.id, variant.id, 1);
    await addToCart(buyerB.id, product.id, variant.id, 1);

    const concurrent = await Promise.allSettled([
        checkoutService.checkout(buyerA.id, {}, oneSlotCoupon.code),
        checkoutService.checkout(buyerB.id, {}, oneSlotCoupon.code),
    ]);

    const successCount = concurrent.filter((r) => r.status === 'fulfilled').length;
    const failCount = concurrent.filter((r) => r.status === 'rejected').length;

    assert(successCount === 1, `Expected exactly one success for last slot coupon, got ${successCount}`);
    assert(failCount === 1, `Expected exactly one rejection for last slot coupon, got ${failCount}`);

    const slotCouponAfter = await prisma.coupon.findUnique({ where: { id: oneSlotCoupon.id } });
    assert((slotCouponAfter?.usedCount ?? 0) <= 1, 'usedCount exceeded usageLimit for last-slot race');

    // 2) Same user double redemption
    const perUserCoupon = await prisma.coupon.create({
        data: {
            code: `PERUSER${now}`,
            type: CouponType.PERCENT,
            value: 10,
            usageLimit: 10,
            perUserLimit: 1,
            validFrom: new Date(Date.now() - 60_000),
            validUntil: new Date(Date.now() + 60 * 60 * 1000),
            isActive: true,
        },
    });

    await addToCart(buyerA.id, product.id, variant.id, 1);
    await checkoutService.checkout(buyerA.id, {}, perUserCoupon.code);

    await addToCart(buyerA.id, product.id, variant.id, 1);
    let secondAttemptRejected = false;
    try {
        await checkoutService.checkout(buyerA.id, {}, perUserCoupon.code);
    } catch {
        secondAttemptRejected = true;
    }
    assert(secondAttemptRejected, 'Second coupon redemption by same user should be rejected');

    // 3) Expired coupon
    const expiredCoupon = await prisma.coupon.create({
        data: {
            code: `EXPIRED${now}`,
            type: CouponType.FLAT,
            value: 50,
            validFrom: new Date(Date.now() - 2 * 60 * 60 * 1000),
            validUntil: new Date(Date.now() - 60 * 60 * 1000),
            isActive: true,
        },
    });

    await addToCart(buyerB.id, product.id, variant.id, 1);
    let expiredRejected = false;
    try {
        await checkoutService.checkout(buyerB.id, {}, expiredCoupon.code);
    } catch {
        expiredRejected = true;
    }
    assert(expiredRejected, 'Expired coupon should be rejected');

    // 4) First-time-only rule violation
    const previousOrder = await prisma.order.create({
        data: {
            userId: buyerB.id,
            status: OrderStatus.CONFIRMED,
            totalAmount: 100,
            subTotalAmount: 100,
            totalTaxAmount: 0,
            grandTotal: 100,
        },
    });
    await prisma.payment.create({
        data: {
            orderId: previousOrder.id,
            userId: buyerB.id,
            amount: 100,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: PaymentProvider.MOCK,
        },
    });

    const firstTimeCoupon = await prisma.coupon.create({
        data: {
            code: `FIRSTONLY${now}`,
            type: CouponType.FLAT,
            value: 80,
            firstTimeUserOnly: true,
            validFrom: new Date(Date.now() - 60_000),
            validUntil: new Date(Date.now() + 60 * 60 * 1000),
            isActive: true,
        },
    });

    await addToCart(buyerB.id, product.id, variant.id, 1);
    let firstTimeRejected = false;
    try {
        await checkoutService.checkout(buyerB.id, {}, firstTimeCoupon.code);
    } catch {
        firstTimeRejected = true;
    }
    assert(firstTimeRejected, 'First-time-only coupon should be rejected for existing successful payer');

    // 5) 100% discount edge case + GST + commission check
    const freeCoupon = await prisma.coupon.create({
        data: {
            code: `FREE100${now}`,
            type: CouponType.PERCENT,
            value: 100,
            usageLimit: 5,
            validFrom: new Date(Date.now() - 60_000),
            validUntil: new Date(Date.now() + 60 * 60 * 1000),
            isActive: true,
        },
    });

    await addToCart(buyerA.id, product.id, variant.id, 1);
    const freeOrderResult = await checkoutService.checkout(buyerA.id, {}, freeCoupon.code);
    const freeOrderId = freeOrderResult.order.id;

    const freeOrder = await prisma.order.findUnique({ where: { id: freeOrderId }, include: { items: true } });
    assert(!!freeOrder, 'Free order not found');
    assert((freeOrder?.grandTotal ?? 0) >= 0, 'Grand total must never be negative');
    assert((freeOrder?.totalTaxAmount ?? -1) === 0, 'GST must be zero on 100% discounted taxable base');
    assert((freeOrder?.subTotalAmount ?? -1) === 0, 'Taxable subtotal must be zero on 100% discount');

    const freeItem = freeOrder!.items[0]!;
    assert(freeItem.taxableAmount === 0, 'Item taxable should be 0 for 100% discount');
    assert(freeItem.cgstAmount === 0 && freeItem.sgstAmount === 0 && freeItem.igstAmount === 0, 'Item GST should be 0 for 100% discount');

    await prisma.payment.create({
        data: {
            orderId: freeOrderId,
            userId: buyerA.id,
            amount: freeOrder!.grandTotal,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: PaymentProvider.MOCK,
        },
    });
    await commissionService.calculateAndStoreSellerSettlement(freeOrderId);

    const settlement = await prisma.sellerSettlement.findFirst({ where: { orderId: freeOrderId, sellerId: seller.id } });
    assert(!!settlement, 'Settlement should exist for free order');
    assert(settlement!.grossAmount === 0, 'Commission gross should use discounted taxable value (0 for free order)');
    assert(settlement!.commissionAmount === 0, 'Commission should be zero for free order taxable value');

    const redemptionCount = await prisma.couponRedemption.count({ where: { orderId: freeOrderId } });
    assert(redemptionCount === 1, 'Exactly one redemption row should exist for free order');

    const badUsedCount = await prisma.coupon.findMany({ where: { usageLimit: { not: null }, usedCount: { gt: 1 }, id: oneSlotCoupon.id } });
    assert(badUsedCount.length === 0, 'usedCount exceeded usageLimit in race test');

    console.log('✅ Coupon race simulation passed');
}

run()
    .catch((error) => {
        console.error('❌ Coupon race simulation failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
