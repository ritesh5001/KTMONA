import { OrderStatus, PaymentProvider, PaymentStatus, ProductStatus, ReturnStatus, Role, ShipmentStatus, UserStatus, } from '@prisma/client';
import { prisma } from './test-utils.js';
import { returnService } from '../src/services/return.service.js';
function randomDelay(maxMs) {
    const ms = Math.floor(Math.random() * maxMs);
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
async function run() {
    const now = Date.now();
    // ── Seed users ──────────────────────────────────────────────────
    const admin = await prisma.user.create({
        data: {
            email: `return-admin-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });
    const seller = await prisma.user.create({
        data: {
            email: `return-seller-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.SELLER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });
    const buyer = await prisma.user.create({
        data: {
            email: `return-buyer-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.USER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });
    // ── Seed product + variant + inventory ──────────────────────────
    const category = await prisma.category.create({
        data: {
            name: `Return Category ${now}`,
            slug: `return-category-${now}`,
            isActive: true,
        },
    });
    const product = await prisma.product.create({
        data: {
            sellerId: seller.id,
            categoryId: category.id,
            title: `Return Product ${now}`,
            description: 'Return race simulation product',
            sellerPrice: 500,
            adminListingPrice: 650,
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
            sku: `RETURN-SKU-${now}`,
            sellerPrice: 500,
            adminListingPrice: 650,
            price: 650,
            compareAtPrice: 799,
            status: ProductStatus.APPROVED,
            inventory: {
                create: {
                    stock: 5, // starts at 5 (already deducted 2 for delivered order)
                },
            },
        },
    });
    // ── Seed a DELIVERED order with shipment + payment ──────────────
    const order = await prisma.order.create({
        data: {
            userId: buyer.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 1300,
            items: {
                create: [
                    {
                        sellerId: seller.id,
                        productId: product.id,
                        variantId: variant.id,
                        quantity: 2,
                        priceSnapshot: 650,
                        sellerPriceSnapshot: 500,
                        adminPriceSnapshot: 650,
                        platformMargin: 150,
                    },
                ],
            },
            movements: {
                create: [
                    {
                        variantId: variant.id,
                        quantity: 2,
                        type: 'RESERVE',
                    },
                    {
                        variantId: variant.id,
                        quantity: 2,
                        type: 'DEDUCT',
                    },
                ],
            },
        },
        include: {
            items: true,
        },
    });
    // Create a DELIVERED shipment with delivered_at set to now (within 7-day window)
    await prisma.shipments.create({
        data: {
            id: `shipment-${now}`,
            order_id: order.id,
            seller_id: seller.id,
            carrier: 'TestCarrier',
            tracking_number: `RETURN-TRACK-${now}`,
            status: ShipmentStatus.DELIVERED,
            shipped_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // shipped 2 days ago
            delivered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // delivered yesterday
            updated_at: new Date(),
        },
    });
    const payment = await prisma.payment.create({
        data: {
            orderId: order.id,
            userId: buyer.id,
            amount: 1300,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: PaymentProvider.MOCK,
        },
    });
    const orderItem = order.items[0];
    console.log('\n=== simulate-return-race ===');
    console.log('Setup:', {
        orderId: order.id,
        orderItemId: orderItem.id,
        variantId: variant.id,
        initialStock: 5,
        paymentStatus: payment.status,
    });
    // ── Create the return request (buyer action) ────────────────────
    const returnReq = await returnService.requestReturn(buyer.id, order.id, 'Race simulation return request', [{ orderItemId: orderItem.id, quantity: 1 }]);
    console.log('Return request created:', {
        returnId: returnReq.id,
        refundAmount: returnReq.refundAmount,
        status: returnReq.status,
    });
    // ── Fire concurrent admin actions ───────────────────────────────
    // 1. approve + 2. approve again (double approve) + 3. processRefund (before approval settles)
    const approvePromise1 = (async () => {
        await randomDelay(20);
        return returnService.approveReturn(admin.id, returnReq.id);
    })();
    const approvePromise2 = (async () => {
        await randomDelay(20);
        return returnService.approveReturn(admin.id, returnReq.id);
    })();
    const refundPromise = (async () => {
        await randomDelay(40); // slight delay to let one approve land first
        return returnService.processReturnRefund(admin.id, returnReq.id);
    })();
    const results = await Promise.allSettled([approvePromise1, approvePromise2, refundPromise]);
    // ── Verify final state ──────────────────────────────────────────
    const finalReturn = await prisma.returnRequest.findUnique({
        where: { id: returnReq.id },
        include: { items: true },
    });
    const finalOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
            payment: true,
            movements: true,
        },
    });
    const finalInventory = await prisma.inventory.findUnique({
        where: { variantId: variant.id },
    });
    const releaseMovements = await prisma.inventoryMovement.findMany({
        where: {
            orderId: order.id,
            variantId: variant.id,
            type: 'RELEASE',
        },
    });
    // ── Assertions ──────────────────────────────────────────────────
    assert(finalReturn !== null, 'Final return must exist');
    assert(finalInventory !== null, 'Final inventory must exist');
    assert((finalInventory?.stock ?? -1) >= 0, 'Inventory stock must never be negative');
    assert(releaseMovements.length <= 1, 'No duplicate RELEASE movements should exist (idempotency)');
    // If approved, stock should have been incremented by return quantity (1)
    if (finalReturn?.status === ReturnStatus.APPROVED || finalReturn?.status === ReturnStatus.REFUNDED) {
        assert(releaseMovements.length === 1, 'Exactly 1 RELEASE movement should exist after approval');
        assert(finalInventory.stock === 6, `Stock should be 6 (5 + 1 returned), got ${finalInventory.stock}`);
    }
    // Payment status checks
    if (finalReturn?.status === ReturnStatus.REFUNDED) {
        assert(finalOrder?.payment?.status === PaymentStatus.REFUNDED, 'Payment should be REFUNDED when return is REFUNDED');
    }
    // Double-approve safety: at most one approve succeeds, the other sees alreadyApproved
    const approveOutcomes = results.slice(0, 2).map((r) => {
        if (r.status === 'fulfilled')
            return r.value.alreadyApproved ? 'idempotent' : 'first';
        return 'rejected';
    });
    const firstCount = approveOutcomes.filter((o) => o === 'first').length;
    assert(firstCount <= 1, `At most 1 fresh approval expected, got ${firstCount}`);
    // ── Summary ─────────────────────────────────────────────────────
    console.log('\nConcurrent results:', results.map((r) => r.status));
    console.log('Approve outcomes:', approveOutcomes);
    console.log('Final return:', {
        id: finalReturn?.id,
        status: finalReturn?.status,
        refundAmount: finalReturn?.refundAmount,
    });
    console.log('Final inventory stock:', finalInventory?.stock);
    console.log('Payment status:', finalOrder?.payment?.status);
    console.log('RELEASE movements:', releaseMovements.length);
    console.log('\n✅ All return race assertions passed');
}
run()
    .catch((error) => {
    console.error('\n❌ Return race simulation FAILED:', error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=simulate-return-race.js.map