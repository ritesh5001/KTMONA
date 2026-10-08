/**
 * Shipping Service Verification Script
 * Tests shipping lifecycle: Creation, Tracking, Status Updates, Order Sync
 */
import { PrismaClient, OrderStatus } from '@prisma/client';
import { generateAccessToken, Role, UserStatus } from '../src/utils/jwt.util.js';
import { env } from '../src/config/env.js';
const prisma = new PrismaClient();
const API_URL = `http://localhost:${env.PORT}/v1`;
async function verifyShipping() {
    console.log('🚀 Starting Shipping Service Verification...');
    try {
        // =========================================================================
        // 1. Setup: Create test users and data
        // =========================================================================
        console.log('\n📦 Setting up test data...');
        // Create Admin
        const admin = await prisma.user.create({
            data: {
                email: `admin_ship_${Date.now()}@test.com`,
                passwordHash: 'hash',
                role: Role.ADMIN,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Seller 1
        const seller1 = await prisma.user.create({
            data: {
                email: `seller1_ship_${Date.now()}@test.com`,
                passwordHash: 'hash',
                role: Role.SELLER,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Seller 2
        const seller2 = await prisma.user.create({
            data: {
                email: `seller2_ship_${Date.now()}@test.com`,
                passwordHash: 'hash',
                role: Role.SELLER,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Buyer
        const buyer = await prisma.user.create({
            data: {
                email: `buyer_ship_${Date.now()}@test.com`,
                passwordHash: 'hash',
                role: Role.USER,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Category
        const category = await prisma.category.upsert({
            where: { slug: 'ship-test-cat' },
            update: {},
            create: { name: 'Shipping Test Category', slug: 'ship-test-cat' }
        });
        // Create Product for Seller 1
        const product1 = await prisma.product.create({
            data: {
                sellerId: seller1.id,
                categoryId: category.id,
                title: 'Product 1',
                isPublished: true,
                status: 'APPROVED',
                sellerPrice: 100,
                adminListingPrice: 120,
                variants: {
                    create: { size: 'Default', sku: `SKU1_${Date.now()}`, sellerPrice: 100, adminListingPrice: 120, price: 120, status: 'APPROVED', inventory: { create: { stock: 100 } } }
                }
            },
            include: { variants: true }
        });
        // Create Product for Seller 2
        const product2 = await prisma.product.create({
            data: {
                sellerId: seller2.id,
                categoryId: category.id,
                title: 'Product 2',
                isPublished: true,
                status: 'APPROVED',
                sellerPrice: 200,
                adminListingPrice: 240,
                variants: {
                    create: { size: 'Default', sku: `SKU2_${Date.now()}`, sellerPrice: 200, adminListingPrice: 240, price: 240, status: 'APPROVED', inventory: { create: { stock: 100 } } }
                }
            },
            include: { variants: true }
        });
        // Create Order with items from BOTH sellers
        const order = await prisma.order.create({
            data: {
                userId: buyer.id,
                status: OrderStatus.CONFIRMED, // Must be CONFIRMED to ship
                totalAmount: 300,
                items: {
                    create: [
                        {
                            sellerId: seller1.id,
                            productId: product1.id,
                            variantId: product1.variants[0].id,
                            quantity: 1,
                            priceSnapshot: 120,
                            sellerPriceSnapshot: 100,
                            adminPriceSnapshot: 120,
                            platformMargin: 20,
                        },
                        {
                            sellerId: seller2.id,
                            productId: product2.id,
                            variantId: product2.variants[0].id,
                            quantity: 1,
                            priceSnapshot: 240,
                            sellerPriceSnapshot: 200,
                            adminPriceSnapshot: 240,
                            platformMargin: 40,
                        }
                    ]
                }
            }
        });
        console.log(`✅ Setup complete. Order: ${order.id}`);
        // Generate Tokens
        const buyerToken = generateAccessToken({ userId: buyer.id, email: buyer.email, phone: null, role: buyer.role, status: buyer.status, isEmailVerified: true, isPhoneVerified: true });
        const seller1Token = generateAccessToken({ userId: seller1.id, email: seller1.email, phone: null, role: seller1.role, status: seller1.status, isEmailVerified: true, isPhoneVerified: true });
        const seller2Token = generateAccessToken({ userId: seller2.id, email: seller2.email, phone: null, role: seller2.role, status: seller2.status, isEmailVerified: true, isPhoneVerified: true });
        const adminToken = generateAccessToken({ userId: admin.id, email: admin.email, phone: null, role: admin.role, status: admin.status, isEmailVerified: true, isPhoneVerified: true });
        // =========================================================================
        // 2. Test Buyer Tracking (Initial)
        // =========================================================================
        console.log('\n🔍 Testing Buyer Tracking (Initial)...');
        const track1 = await fetch(`${API_URL}/orders/${order.id}/tracking`, {
            headers: { 'Authorization': `Bearer ${buyerToken}` }
        });
        const track1Data = await track1.json();
        if (!track1Data.success || !track1Data.data) {
            console.error('Tracking Response:', JSON.stringify(track1Data, null, 2));
            throw new Error('Tracking data missing or success false');
        }
        if (track1Data.data.shipments.length !== 0)
            throw new Error('Shipments should be empty');
        console.log('✅ Tracking empty as expected');
        // =========================================================================
        // 3. Test Shipment Creation (Seller 1)
        // =========================================================================
        console.log('\n🚢 Testing Create Shipment (Seller 1)...');
        const create1 = await fetch(`${API_URL}/seller/shipments/${order.id}/create`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${seller1Token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ carrier: 'FedEx', trackingNumber: 'TRK123' })
        });
        const s1Data = await create1.json();
        if (!s1Data.success)
            throw new Error(`Failed to create shipment: ${JSON.stringify(s1Data)}`);
        const shipment1Id = s1Data.data.id;
        console.log('✅ Shipment 1 created');
        // Verify Order status is STILL CONFIRMED
        const checkOrder1 = await prisma.order.findUnique({ where: { id: order.id } });
        if (checkOrder1?.status !== 'CONFIRMED')
            throw new Error(`Order status check failed. Expected CONFIRMED, got ${checkOrder1?.status}`);
        // =========================================================================
        // 4. Test Shipment Creation (Seller 2)
        // =========================================================================
        console.log('\n🚢 Testing Create Shipment (Seller 2)...');
        const create2 = await fetch(`${API_URL}/seller/shipments/${order.id}/create`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${seller2Token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ carrier: 'UPS', trackingNumber: 'TRK456' })
        });
        const s2Data = await create2.json();
        if (!s2Data.success)
            throw new Error(`Failed to create shipment 2: ${JSON.stringify(s2Data)}`);
        const shipment2Id = s2Data.data.id;
        console.log('✅ Shipment 2 created');
        // =========================================================================
        // 5. Test Update Status -> SHIPPED
        // =========================================================================
        console.log('\n📦 Testing Mark SHIPPED...');
        // Seller 1 Ships
        await fetch(`${API_URL}/seller/shipments/${shipment1Id}/ship`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${seller1Token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: 'Handed to carrier' })
        });
        // Check Order - Should still be CONFIRMED
        const checkOrder2 = await prisma.order.findUnique({ where: { id: order.id } });
        if (checkOrder2?.status !== 'CONFIRMED')
            throw new Error(`Order status check failed (Partial Ship). Expected CONFIRMED, got ${checkOrder2?.status}`);
        console.log('✅ Order remains CONFIRMED after partial shipping');
        // Seller 2 Ships
        await fetch(`${API_URL}/seller/shipments/${shipment2Id}/ship`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${seller2Token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: 'Shipped too' })
        });
        // Check Order - Should be SHIPPED now
        const checkOrder3 = await prisma.order.findUnique({ where: { id: order.id } });
        if (checkOrder3?.status !== 'SHIPPED')
            throw new Error(`Order status check failed (Full Ship). Expected SHIPPED, got ${checkOrder3?.status}`);
        console.log('✅ Order updated to SHIPPED after all sellers shipped');
        // =========================================================================
        // 6. Test Tracking Update
        // =========================================================================
        console.log('\n🔍 Testing Buyer Tracking (Updated)...');
        const track2 = await fetch(`${API_URL}/orders/${order.id}/tracking`, {
            headers: { 'Authorization': `Bearer ${buyerToken}` }
        });
        const track2Data = await track2.json();
        if (track2Data.data.shipments.length !== 2)
            throw new Error('Should see 2 shipments');
        if (track2Data.data.status !== 'SHIPPED')
            throw new Error('Tracking status mismatch');
        console.log('✅ Tracking reflects shipments and status');
        // =========================================================================
        // 7. Test Admin Override
        // =========================================================================
        console.log('\n👮 Testing Admin Override...');
        // Force one back to DELIVERED (skip delivered call)
        const override = await fetch(`${API_URL}/admin/shipments/${shipment1Id}/override-status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'DELIVERED', note: 'Admin Force' })
        });
        if (override.status !== 200)
            throw new Error('Admin override failed');
        // Verify Shipment 1 is DELIVERED
        const s1Check = await prisma.shipments.findUnique({ where: { id: shipment1Id } });
        if (s1Check?.status !== 'DELIVERED')
            throw new Error('Shipment 1 not DELIVERED');
        // Verify Order is still SHIPPED (because Shipment 2 is only SHIPPED)
        const checkOrder4 = await prisma.order.findUnique({ where: { id: order.id } });
        if (checkOrder4?.status !== 'SHIPPED')
            throw new Error(`Order status check failed. Expected SHIPPED, got ${checkOrder4?.status}`);
        console.log('✅ Admin override successful & Order status logic holds');
        console.log('\n🎉 Shipping verification passed!');
    }
    catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
}
// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyShipping().then(async () => {
        await prisma.$disconnect();
    }).catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
}
export { verifyShipping };
//# sourceMappingURL=verify-shipping.js.map