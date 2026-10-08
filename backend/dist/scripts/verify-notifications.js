import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { generateAccessToken, Role, UserStatus } from '../src/utils/jwt.util.js';
const prisma = new PrismaClient();
const BASE_URL = `http://localhost:${env.PORT}`;
// Helper Wrapper for fetch
async function request(path, method = 'GET', body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token)
        headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });
    // Attempt to parse JSON
    let data;
    try {
        data = await res.json();
    }
    catch {
        data = null;
    }
    return { status: res.status, ok: res.ok, data: data };
}
async function verifyNotifications() {
    console.log('🚀 Starting Notification Verification...');
    let buyerId = '';
    let sellerId = '';
    let productId = '';
    let variantId = '';
    let orderId = '';
    try {
        // 1. Setup Users (Direct DB for speed)
        console.log('📦 Setting up Users...');
        const timestamp = Date.now();
        const buyer = await prisma.user.create({
            data: {
                email: `notify_buyer_${timestamp}@test.com`,
                passwordHash: 'hash',
                role: Role.USER,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        buyerId = buyer.id;
        const seller = await prisma.user.create({
            data: {
                email: `notify_seller_${timestamp}@test.com`,
                passwordHash: 'hash',
                role: Role.SELLER,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        sellerId = seller.id;
        const admin = await prisma.user.create({
            data: {
                email: `notify_admin_${timestamp}@test.com`,
                passwordHash: 'hash',
                role: Role.ADMIN,
                status: UserStatus.ACTIVE,
                isEmailVerified: true,
            }
        });
        // Generate Tokens
        const buyerToken = generateAccessToken({ userId: buyer.id, email: buyer.email, phone: null, role: buyer.role, status: buyer.status, isEmailVerified: true, isPhoneVerified: true });
        const sellerToken = generateAccessToken({ userId: seller.id, email: seller.email, phone: null, role: seller.role, status: seller.status, isEmailVerified: true, isPhoneVerified: true });
        const adminToken = generateAccessToken({ userId: admin.id, email: admin.email, phone: null, role: admin.role, status: admin.status, isEmailVerified: true, isPhoneVerified: true });
        // 2. Create Product (API to ensure Search/Variants logic holds)
        console.log('📦 Creating Product...');
        const category = await prisma.category.upsert({
            where: { slug: 'notify-cat' },
            create: { name: 'Notify Cat', slug: 'notify-cat' },
            update: {}
        });
        const prodRes = await request('/v1/seller/products', 'POST', {
            title: 'Notify Product',
            description: 'Desc',
            categoryId: category.id,
            isPublished: true,
            sellerPrice: 100,
        }, sellerToken);
        if (!prodRes.ok)
            throw new Error(`Product create failed: ${JSON.stringify(prodRes.data)}`);
        // Handle { message, product } or { success, data: { product } }
        const product = prodRes.data.product || prodRes.data.data?.product;
        productId = product.id;
        // Create Variant
        const varRes = await request(`/v1/seller/products/${productId}/variants`, 'POST', {
            sku: `NOTIFY_SKU_${timestamp}`,
            price: 100,
            initialStock: 50
        }, sellerToken);
        if (!varRes.ok)
            throw new Error(`Variant create failed: ${JSON.stringify(varRes.data)}`);
        const variant = varRes.data.variant || varRes.data.data?.variant;
        variantId = variant.id;
        await request(`/v1/admin/products/${productId}/approve`, 'PUT', {}, adminToken);
        await request(`/v1/admin/products/${productId}/set-price`, 'PATCH', { adminListingPrice: 120 }, adminToken);
        // 3. Place Order (Updates triggers Notifications)
        console.log('🛒 Placing Order...');
        await request('/v1/cart/items', 'POST', { productId, variantId, quantity: 1 }, buyerToken);
        const checkoutRes = await request('/v1/checkout', 'POST', {}, buyerToken);
        if (!checkoutRes.ok)
            throw new Error(`Checkout failed: ${JSON.stringify(checkoutRes.data)}`);
        const orderResData = checkoutRes.data.order || checkoutRes.data.data?.order;
        orderId = orderResData.id;
        console.log(`✅ Order Placed: ${orderId}`);
        // 4. Verify ORDER_PLACED & SELLER_NEW_ORDER
        console.log('⏳ Waiting for notifications (Order Placed)...');
        await new Promise(r => setTimeout(r, 2000));
        const buyerNotif = await prisma.notification.findFirst({
            where: { userId: buyerId, type: 'ORDER_PLACED' },
            orderBy: { createdAt: 'desc' }
        });
        if (!buyerNotif)
            throw new Error('ORDER_PLACED notification missing for Buyer');
        console.log(`✅ Buyer Notified: ${buyerNotif.status} (Email: ${buyer.email})`);
        const sellerNotif = await prisma.notification.findFirst({
            where: { userId: sellerId, type: 'SELLER_NEW_ORDER' },
            orderBy: { createdAt: 'desc' }
        });
        if (!sellerNotif)
            throw new Error('SELLER_NEW_ORDER notification missing for Seller');
        console.log(`✅ Seller Notified: ${sellerNotif.status} (Email: ${seller.email})`);
        // 5. Ship Order -> ORDER_SHIPPED
        console.log('🚢 Shipping Order...');
        // Confirm Order via DB (to bypass payment)
        await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
        // Create Shipment
        const shipCreateRes = await request(`/v1/seller/shipments/${orderId}/create`, 'POST', {
            carrier: 'DHL',
            trackingNumber: '123456'
        }, sellerToken);
        if (!shipCreateRes.ok)
            throw new Error(`Shipment Create failed: ${JSON.stringify(shipCreateRes.data)}`);
        const shipmentId = shipCreateRes.data.data?.id || shipCreateRes.data.id;
        // Mark Shipped
        const shipRes = await request(`/v1/seller/shipments/${shipmentId}/ship`, 'PUT', {}, sellerToken);
        if (!shipRes.ok)
            throw new Error(`Mark Shipped failed: ${JSON.stringify(shipRes.data)}`);
        // Verify ORDER_SHIPPED
        console.log('⏳ Waiting for notifications (Order Shipped)...');
        await new Promise(r => setTimeout(r, 2000));
        const shippedNotif = await prisma.notification.findFirst({
            where: { userId: buyerId, type: 'ORDER_SHIPPED' },
            orderBy: { createdAt: 'desc' }
        });
        if (!shippedNotif)
            throw new Error('ORDER_SHIPPED notification missing');
        console.log(`✅ Buyer Notified (Shipped): ${shippedNotif.status}`);
        console.log('\n🎉 ALL NOTIFICATION TESTS PASSED');
    }
    catch (e) {
        console.error('❌ Notification Verification Failed:', e);
        throw e;
    }
}
// Allow standalone run
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyNotifications()
        .catch(() => process.exit(1))
        .finally(async () => await prisma.$disconnect());
}
export { verifyNotifications };
//# sourceMappingURL=verify-notifications.js.map