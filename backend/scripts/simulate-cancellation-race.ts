import { CancellationStatus, OrderStatus, PaymentProvider, PaymentStatus, ProductStatus, Role, ShipmentStatus, UserStatus } from '@prisma/client';
import { prisma } from './test-utils.js';
import { cancellationService } from '../src/services/cancellation.service.js';
import { paymentService } from '../src/services/payment.service.js';
import { shipmentService } from '../src/services/shipment.service.js';

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

    const admin = await prisma.user.create({
        data: {
            email: `race-admin-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    const seller = await prisma.user.create({
        data: {
            email: `race-seller-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.SELLER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    const buyer = await prisma.user.create({
        data: {
            email: `race-buyer-${now}@test.com`,
            passwordHash: 'hash',
            role: Role.USER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    const category = await prisma.category.create({
        data: {
            name: `Race Category ${now}`,
            slug: `race-category-${now}`,
            isActive: true,
        },
    });

    const product = await prisma.product.create({
        data: {
            sellerId: seller.id,
            categoryId: category.id,
            title: `Race Product ${now}`,
            description: 'Race simulation product',
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
            sku: `RACE-SKU-${now}`,
            sellerPrice: 500,
            adminListingPrice: 650,
            price: 650,
            compareAtPrice: 799,
            status: ProductStatus.APPROVED,
            inventory: {
                create: {
                    stock: 8,
                },
            },
        },
    });

    const order = await prisma.order.create({
        data: {
            userId: buyer.id,
            status: OrderStatus.CONFIRMED,
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
                ],
            },
        },
        include: {
            items: true,
        },
    });

    const payment = await prisma.payment.create({
        data: {
            orderId: order.id,
            userId: buyer.id,
            amount: 1300,
            currency: 'INR',
            status: PaymentStatus.INITIATED,
            provider: PaymentProvider.MOCK,
        },
    });

    const cancellation = await prisma.cancellationRequest.create({
        data: {
            orderId: order.id,
            userId: buyer.id,
            reason: 'Race simulation request',
            status: CancellationStatus.REQUESTED,
        },
    });

    const approvePromise = (async () => {
        await randomDelay(30);
        return cancellationService.approveCancellation(admin.id, cancellation.id);
    })();

    const paymentSuccessPromise = (async () => {
        await randomDelay(30);
        return paymentService.handlePaymentSuccess(
            payment.id,
            order.id,
            `mockpay_${now}`,
            { source: 'simulate-cancellation-race' },
        );
    })();

    const shipmentPromise = (async () => {
        await randomDelay(30);
        const shipment = await shipmentService.createShipment(order.id, seller.id, {
            carrier: 'RaceCarrier',
            trackingNumber: `RACE-${now}`,
        });
        return shipmentService.updateStatus(shipment.id, seller.id, ShipmentStatus.SHIPPED, 'race script');
    })();

    const results = await Promise.allSettled([approvePromise, paymentSuccessPromise, shipmentPromise]);

    const finalOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
            payment: true,
            movements: true,
            cancellationRequest: true,
            shipments: true,
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

    assert(finalOrder !== null, 'Final order must exist');
    assert(finalInventory !== null, 'Final inventory must exist');
    assert((finalInventory?.stock ?? -1) >= 0, 'Inventory stock must never be negative');
    assert(releaseMovements.length <= 1, 'No duplicate RELEASE movement should exist');

    const shippedExists = (finalOrder?.shipments ?? []).some((s) => s.status === 'SHIPPED');
    const paymentStatus = finalOrder?.payment?.status ?? null;
    const cancellationStatus = finalOrder?.cancellationRequest?.status ?? null;

    if (shippedExists) {
        assert(cancellationStatus !== 'APPROVED', 'Cancellation must fail if shipment is SHIPPED');
        assert(paymentStatus !== 'REFUNDED', 'Refund must NOT trigger when shipment is SHIPPED');
        assert(releaseMovements.length === 0, 'Inventory must NOT be restored when shipment is SHIPPED');
    }

    const movementCount = await prisma.inventoryMovement.count({ where: { orderId: order.id } });

    console.log('\n=== simulate-cancellation-race ===');
    console.log('Concurrent results:', results.map((r) => r.status));
    console.log('Final order:', {
        id: finalOrder?.id,
        status: finalOrder?.status,
        cancellationStatus,
        shipmentStatuses: finalOrder?.shipments.map((s) => s.status),
    });
    console.log('Inventory stock:', finalInventory?.stock);
    console.log('Payment status:', paymentStatus);
    console.log('Movement count:', movementCount, 'releaseCount:', releaseMovements.length);
    console.log('Assertions passed ✅');
}

run()
    .catch((error) => {
        console.error('Simulation failed ❌', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
