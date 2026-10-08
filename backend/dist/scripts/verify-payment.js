import { PrismaClient, PaymentStatus, OrderStatus } from '@prisma/client';
import { generateAccessToken, Role, UserStatus } from '../src/utils/jwt.util.js';
import { env } from '../src/config/env.js';
import { paymentService } from '../src/services/payment.service.js';
const prisma = new PrismaClient();
const API_URL = `http://localhost:${env.PORT}/v1`;
async function verifyPayment() {
    console.log('🚀 Starting Payment Service Verification...');
    try {
        // 1. Setup: Create Buyer, Seller, Product, Order
        console.log('\n📦 Setting up test data...');
        // Create Buyer
        const buyerEmail = `buyer_${Date.now()}@test.com`;
        let buyer = await prisma.user.create({
            data: {
                email: buyerEmail,
                passwordHash: 'hash',
                role: Role.USER,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Seller
        const sellerEmail = `seller_${Date.now()}@test.com`;
        const seller = await prisma.user.create({
            data: {
                email: sellerEmail,
                passwordHash: 'hash',
                role: Role.SELLER,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Category
        const category = await prisma.category.upsert({
            where: { slug: 'test-category' },
            update: {},
            create: { name: 'Test Category', slug: 'test-category' }
        });
        // Create Product & Variant
        const product = await prisma.product.create({
            data: {
                sellerId: seller.id,
                categoryId: category.id,
                title: 'Test Product',
                isPublished: true,
                status: 'APPROVED',
                sellerPrice: 1000,
                adminListingPrice: 1200,
                variants: {
                    create: {
                        size: 'Default',
                        sku: `SKU_${Date.now()}`,
                        sellerPrice: 1000,
                        adminListingPrice: 1200,
                        price: 1200,
                        status: 'APPROVED',
                        inventory: { create: { stock: 10 } }
                    }
                }
            },
            include: { variants: true }
        });
        if (!product.variants || product.variants.length === 0) {
            throw new Error("Failed to create product variant");
        }
        const variant = product.variants[0];
        if (!variant) {
            throw new Error("Failed to resolve product variant");
        }
        // Create Order (PLACED)
        const order = await prisma.order.create({
            data: {
                userId: buyer.id,
                status: OrderStatus.PLACED,
                totalAmount: 1000,
                items: {
                    create: {
                        sellerId: seller.id,
                        productId: product.id,
                        variantId: variant.id,
                        quantity: 1,
                        priceSnapshot: 1200,
                        sellerPriceSnapshot: 1000,
                        adminPriceSnapshot: 1200,
                        platformMargin: 200,
                    }
                }
            }
        });
        console.log(`✅ Setup complete. Order ID: ${order.id}`);
        // Generate Token
        const token = generateAccessToken({
            userId: buyer.id,
            email: buyer.email,
            phone: null,
            role: buyer.role,
            status: buyer.status,
            isEmailVerified: true,
            isPhoneVerified: true
        });
        // 2. Test Initiate Payment
        console.log('\n💳 testing POST /v1/payments/initiate...');
        const initRes = await fetch(`${API_URL}/payments/initiate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                orderId: order.id,
                platform: 'WEB'
            })
        });
        const initData = await initRes.json();
        console.log('Initiate Response:', JSON.stringify(initData, null, 2));
        if (!initData.success) {
            throw new Error('Payment initiation failed');
        }
        const { paymentId, redirectUrl } = initData.data;
        if (!paymentId || !redirectUrl) {
            throw new Error('Invalid payment initiation response');
        }
        // Verify DB
        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment || payment.status !== PaymentStatus.INITIATED) {
            throw new Error('Payment not recorded as INITIATED in DB');
        }
        console.log('✅ Payment initiated successfully');
        // 3. Test Webhook (Success)
        console.log('\n🔔 testing payment success settlement path...');
        // There is no MOCK webhook any more: PhonePe is the only provider and its
        // webhook is signature-checked then re-confirmed against the live Order Status
        // API. Invoke the same handler the verified webhook calls, so this still covers
        // order confirmation + seller settlement creation without faking a real payment.
        await paymentService.handlePaymentSuccess(paymentId, order.id, `verify_${Date.now()}`, { source: 'verify-payment-script' });
        // Verify DB Changes
        const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
        const updatedPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
        const settlements = await prisma.sellerSettlement.findMany({ where: { sellerId: seller.id } });
        console.log('Updated Order Status:', updatedOrder?.status);
        console.log('Updated Payment Status:', updatedPayment?.status);
        console.log('Seller Settlements:', settlements.length);
        if (updatedOrder?.status !== OrderStatus.CONFIRMED) {
            throw new Error('Order not confirmed');
        }
        if (updatedPayment?.status !== PaymentStatus.SUCCESS) {
            throw new Error('Payment not marked SUCCESS');
        }
        if (settlements.length === 0) {
            throw new Error('Settlements not created');
        }
        console.log('✅ Payment success flow verified');
        // 4. Verify Get Payment Details
        console.log('\n🔍 testing GET /v1/payments/:orderId...');
        const getRes = await fetch(`${API_URL}/payments/${order.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const getData = await getRes.json();
        if (!getData.success || getData.data.status !== 'SUCCESS') {
            throw new Error('Get Payment Details failed');
        }
        console.log('✅ Get Payment Details verified');
    }
    catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
    finally {
        // Don't disconnect here if imported, but since we are running isolated or via verify-all which handles disconnect? 
        // existing verify-all handles disconnect. wrapper here shouldn't disconnect if called by verify-all?
        // verify-all calls verifyAuth which does NOT disconnect.
        // So I should NOT disconnect if not main.
    }
}
// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyPayment().then(async () => {
        await prisma.$disconnect();
    }).catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
}
export { verifyPayment };
//# sourceMappingURL=verify-payment.js.map