import { prisma } from '../src/config/db.js';
import { env } from '../src/config/env.js';
const BASE_URL = `http://localhost:${env.PORT}`;
const TEST_USER = {
    email: 'dgiri1415@gmail.com',
    password: 'Ritesh5001',
    phone: '7007436164',
    fullName: 'Live Test User',
    role: 'USER'
};
async function runLiveTest() {
    console.log('🚀 Starting LIVE Notification Test...');
    console.log(`Target Email: ${TEST_USER.email}`);
    try {
        // CLEANUP: Delete existing user to ensure fresh start
        console.log('🧹 Cleaning up old test data...');
        try {
            await prisma.user.deleteMany({
                where: {
                    OR: [
                        { email: TEST_USER.email },
                        { phone: TEST_USER.phone }
                    ]
                }
            });
        }
        catch (e) {
            // console.log('Cleanup ignored.');
        }
        // 1. Authenticate (Register -> Login)
        let token = '';
        let userId = '';
        console.log('🔑 Registering...');
        const regRes = await fetch(`${BASE_URL}/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });
        if (regRes.status !== 201) {
            const regErr = await regRes.json();
            console.log(`Registration info: ${JSON.stringify(regErr)}`);
        }
        else {
            console.log('✅ Registered successfully.');
        }
        console.log('🔑 Logging in...');
        const loginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: TEST_USER.email,
                password: TEST_USER.password
            })
        });
        const loginData = await loginRes.json();
        if (!loginData.accessToken) {
            throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
        }
        console.log('✅ Logged in successfully.');
        token = loginData.accessToken;
        userId = loginData.user.id;
        // 2. Setup Seller & Product
        console.log('📦 Setting up test seller/product...');
        const sellerEmail = `seller_test_${Date.now()}@test.com`;
        // Register Seller
        const selRes = await fetch(`${BASE_URL}/v1/seller/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: sellerEmail,
                password: 'Password123!',
                phone: `99${Date.now().toString().substring(5)}`,
                storeName: `Test Store ${Date.now()}`
            })
        });
        if (!selRes.ok) {
            const selErr = await selRes.json();
            throw new Error(`Seller registration failed: ${JSON.stringify(selErr)}`);
        }
        // FORCE APPROVE SELLER in DB
        await prisma.user.update({
            where: { email: sellerEmail },
            data: { status: 'ACTIVE' }
        });
        // Login Seller
        const selLoginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: sellerEmail,
                password: 'Password123!'
            })
        });
        const selLoginData = await selLoginRes.json();
        if (!selLoginData.accessToken)
            throw new Error('Seller login failed');
        const sellerToken = selLoginData.accessToken;
        // Create Product (Meta only)
        const cat = await prisma.category.findFirst();
        if (!cat)
            throw new Error('No categories found. Seed database?');
        const prodRes = await fetch(`${BASE_URL}/v1/seller/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sellerToken}`
            },
            body: JSON.stringify({
                title: 'Live Test Item',
                description: 'This is a test item for email verification.',
                categoryId: cat.id,
                isPublished: true // Publish immediately
            })
        });
        const prodData = await prodRes.json();
        if (!prodRes.ok)
            throw new Error(`Product metadata creation failed: ${JSON.stringify(prodData)}`);
        const productId = prodData.product?.id || prodData.data?.product?.id;
        if (!productId)
            throw new Error('Product ID not found in response');
        // Create Variant
        console.log('📦 Adding Variant and Stock...');
        const varRes = await fetch(`${BASE_URL}/v1/seller/products/${productId}/variants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sellerToken}`
            },
            body: JSON.stringify({
                sku: `TEST_${Date.now()}`,
                price: 50,
                compareAtPrice: 60,
                initialStock: 100
            })
        });
        const varData = await varRes.json();
        if (!varRes.ok)
            throw new Error(`Variant creation failed: ${JSON.stringify(varData)}`);
        const variantId = varData.variant?.id || varData.data?.variant?.id;
        // 3. Place Order
        console.log('🛒 Placing Order...');
        // Add to cart
        await fetch(`${BASE_URL}/v1/cart/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ productId, variantId, quantity: 1 })
        });
        // Checkout
        const checkoutRes = await fetch(`${BASE_URL}/v1/checkout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const checkoutData = await checkoutRes.json();
        if (!checkoutRes.ok) {
            throw new Error(`Checkout failed: ${JSON.stringify(checkoutData)}`);
        }
        const orderId = checkoutData.order?.id || checkoutData.data?.order?.id;
        if (!orderId)
            throw new Error(`Order ID not found in checkout response: ${JSON.stringify(checkoutData)}`);
        console.log(`✅ Order ${orderId} placed successfully!`);
        console.log('📧 Notification trigger sent.');
        console.log('⏳ Checking notification status in DB...');
        // 4. Poll for status
        let attempts = 0;
        let success = false;
        while (attempts < 30) {
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
            const notif = await prisma.notification.findFirst({
                where: {
                    userId,
                    type: 'ORDER_PLACED'
                },
                orderBy: { createdAt: 'desc' }
            });
            if (notif) {
                if (notif.status === 'SENT') {
                    console.log(`✅ Notification STATUS: SENT`);
                    console.log(`   Type: ${notif.type}`);
                    console.log(`   To: ${TEST_USER.email}`);
                    console.log(`   Subject: ${notif.subject}`);
                    console.log('   Check your inbox! (Spam folder too)');
                    success = true;
                    break;
                }
                else if (notif.status === 'FAILED') {
                    console.error('❌ Notification FAILED in worker.');
                    const event = await prisma.notificationEvent.findFirst({ where: { notificationId: notif.id } });
                    console.error('   Error:', event?.error);
                    break;
                }
                else {
                    process.stdout.write(` [${notif.status}] `);
                }
            }
            else {
                process.stdout.write('-'); // No notification yet
            }
        }
        if (!success) {
            console.log('\n⚠️ Notification status is PENDING or not found after 30s.');
        }
    }
    catch (error) {
        console.error('❌ Live Test Failed:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
runLiveTest();
//# sourceMappingURL=live-test-notification.js.map