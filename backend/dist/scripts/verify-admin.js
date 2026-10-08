/**
 * Admin Service Verification Script
 * Tests all admin endpoints: sellers, products, orders, payments, settlements, audit logs
 */
import { PrismaClient, OrderStatus } from '@prisma/client';
import { generateAccessToken, Role, UserStatus } from '../src/utils/jwt.util.js';
import { env } from '../src/config/env.js';
const prisma = new PrismaClient();
const API_URL = `http://localhost:${env.PORT}/v1`;
async function verifyAdmin() {
    console.log('🚀 Starting Admin Service Verification...');
    try {
        // 1. Setup: Create test users and data
        console.log('\n📦 Setting up test data...');
        // Create Admin user
        const adminEmail = `admin_${Date.now()}@test.com`;
        const admin = await prisma.user.create({
            data: {
                email: adminEmail,
                passwordHash: 'hash',
                role: Role.ADMIN,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Super Admin user
        const superAdminEmail = `sadmin_${Date.now()}@test.com`;
        const superAdmin = await prisma.user.create({
            data: {
                email: superAdminEmail,
                passwordHash: 'hash',
                role: Role.SUPER_ADMIN,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Seller (pending approval)
        const sellerEmail = `seller_${Date.now()}@test.com`;
        const seller = await prisma.user.create({
            data: {
                email: sellerEmail,
                passwordHash: 'hash',
                role: Role.SELLER,
                status: UserStatus.PENDING,
                isEmailVerified: true
            }
        });
        // Create Buyer for order
        const buyerEmail = `buyer_${Date.now()}@test.com`;
        const buyer = await prisma.user.create({
            data: {
                email: buyerEmail,
                passwordHash: 'hash',
                role: Role.USER,
                status: UserStatus.ACTIVE,
                isEmailVerified: true
            }
        });
        // Create Category
        const category = await prisma.category.upsert({
            where: { slug: 'test-admin-category' },
            update: {},
            create: { name: 'Test Admin Category', slug: 'test-admin-category' }
        });
        // Create Product (needs moderation)
        const product = await prisma.product.create({
            data: {
                sellerId: seller.id,
                categoryId: category.id,
                title: 'Test Admin Product',
                isPublished: false,
                sellerPrice: 500,
                variants: {
                    create: {
                        size: 'Default',
                        sku: `ADM_SKU_${Date.now()}`,
                        sellerPrice: 500,
                        price: 500,
                        status: 'PENDING',
                        inventory: { create: { stock: 10 } }
                    }
                }
            },
            include: { variants: true }
        });
        // Create ProductModeration record
        await prisma.productModeration.create({
            data: {
                productId: product.id,
                status: 'PENDING',
                updated_at: new Date(),
            }
        });
        const variant = product.variants[0];
        // Create Order
        const order = await prisma.order.create({
            data: {
                userId: buyer.id,
                status: OrderStatus.PLACED,
                totalAmount: 500,
                items: {
                    create: {
                        sellerId: seller.id,
                        productId: product.id,
                        variantId: variant.id,
                        quantity: 1,
                        priceSnapshot: 650,
                        sellerPriceSnapshot: 500,
                        adminPriceSnapshot: 650,
                        platformMargin: 150,
                    }
                }
            }
        });
        console.log(`✅ Setup complete. Admin: ${admin.id}, Seller: ${seller.id}, Order: ${order.id}`);
        // Generate Admin Token
        const adminToken = generateAccessToken({
            userId: admin.id,
            email: admin.email,
            phone: null,
            role: admin.role,
            status: admin.status,
            isEmailVerified: true,
            isPhoneVerified: false
        });
        // Generate Super Admin Token
        const superAdminToken = generateAccessToken({
            userId: superAdmin.id,
            email: superAdmin.email,
            phone: null,
            role: superAdmin.role,
            status: superAdmin.status,
            isEmailVerified: true,
            isPhoneVerified: false
        });
        // =========================================================================
        // 2. Test Seller Management
        // =========================================================================
        console.log('\n👥 Testing Seller Management...');
        // GET /v1/admin/sellers
        console.log('Testing GET /v1/admin/sellers...');
        const sellersRes = await fetch(`${API_URL}/admin/sellers`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const sellersData = await sellersRes.json();
        if (!sellersData.sellers || !Array.isArray(sellersData.sellers)) {
            throw new Error('Failed to list sellers');
        }
        console.log(`✅ Listed ${sellersData.sellers.length} sellers`);
        // PUT /v1/admin/sellers/:id/approve
        console.log('Testing PUT /v1/admin/sellers/:id/approve...');
        const approveRes = await fetch(`${API_URL}/admin/sellers/${seller.id}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        const approveData = await approveRes.json();
        if (!approveData.message || approveData.seller?.status !== 'ACTIVE') {
            console.log('Approve Response:', JSON.stringify(approveData, null, 2));
            throw new Error('Failed to approve seller');
        }
        console.log('✅ Seller approved successfully');
        // Verify audit log was created
        const auditLogs1 = await prisma.auditLog.findMany({
            where: { entityId: seller.id, action: 'SELLER_APPROVED' }
        });
        if (auditLogs1.length === 0) {
            throw new Error('Audit log not created for seller approval');
        }
        console.log('✅ Audit log created for seller approval');
        // PUT /v1/admin/sellers/:id/suspend
        console.log('Testing PUT /v1/admin/sellers/:id/suspend...');
        const suspendRes = await fetch(`${API_URL}/admin/sellers/${seller.id}/suspend`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        const suspendData = await suspendRes.json();
        if (!suspendData.message || suspendData.seller?.status !== 'SUSPENDED') {
            console.log('Suspend Response:', JSON.stringify(suspendData, null, 2));
            throw new Error('Failed to suspend seller');
        }
        console.log('✅ Seller suspended successfully');
        // =========================================================================
        // 3. Test Product Moderation
        // =========================================================================
        console.log('\n📦 Testing Product Moderation...');
        // GET /v1/admin/products/pending
        console.log('Testing GET /v1/admin/products/pending...');
        const pendingRes = await fetch(`${API_URL}/admin/products/pending`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const pendingData = await pendingRes.json();
        if (!pendingData.products || !Array.isArray(pendingData.products)) {
            throw new Error('Failed to list pending products');
        }
        console.log(`✅ Found ${pendingData.products.length} pending products`);
        // PUT /v1/admin/products/:id/approve
        console.log('Testing PUT /v1/admin/products/:id/approve...');
        const approveProductRes = await fetch(`${API_URL}/admin/products/${product.id}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        const approveProductData = await approveProductRes.json();
        if (!approveProductData.message) {
            console.log('Approve Product Response:', JSON.stringify(approveProductData, null, 2));
            throw new Error('Failed to approve product');
        }
        console.log('✅ Product approved successfully');
        console.log('Testing PATCH /v1/admin/products/:id/set-price...');
        const setPriceRes = await fetch(`${API_URL}/admin/products/${product.id}/set-price`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ adminListingPrice: 650 })
        });
        const setPriceData = await setPriceRes.json();
        if (!setPriceRes.ok || setPriceData.adminListingPrice !== 650) {
            console.log('Set Price Response:', JSON.stringify(setPriceData, null, 2));
            throw new Error('Failed to set product listing price');
        }
        console.log('✅ Product listing price set successfully');
        console.log('Testing GET /v1/admin/products/pricing-overview...');
        const pricingOverviewRes = await fetch(`${API_URL}/admin/products/pricing-overview`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const pricingOverviewData = await pricingOverviewRes.json();
        if (!pricingOverviewRes.ok || !Array.isArray(pricingOverviewData.products)) {
            throw new Error('Failed to fetch pricing overview');
        }
        console.log('✅ Pricing overview fetched');
        console.log('Testing GET /v1/admin/analytics/profit...');
        const profitRes = await fetch(`${API_URL}/admin/analytics/profit`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const profitData = await profitRes.json();
        if (!profitRes.ok || typeof profitData.totalMarginEarned !== 'number') {
            throw new Error('Failed to fetch profit analytics');
        }
        console.log('✅ Profit analytics fetched');
        // =========================================================================
        // 4. Test Order Management
        // =========================================================================
        console.log('\n🛒 Testing Order Management...');
        // GET /v1/admin/orders
        console.log('Testing GET /v1/admin/orders...');
        const ordersRes = await fetch(`${API_URL}/admin/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const ordersData = await ordersRes.json();
        if (!ordersData.orders || !Array.isArray(ordersData.orders)) {
            throw new Error('Failed to list orders');
        }
        console.log(`✅ Listed ${ordersData.orders.length} orders`);
        // PUT /v1/admin/orders/:id/cancel (ADMIN)
        console.log('Testing PUT /v1/admin/orders/:id/cancel...');
        const cancelRes = await fetch(`${API_URL}/admin/orders/${order.id}/cancel`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        const cancelData = await cancelRes.json();
        if (!cancelData.message || cancelData.order?.status !== 'CANCELLED') {
            console.log('Cancel Response:', JSON.stringify(cancelData, null, 2));
            throw new Error('Failed to cancel order');
        }
        console.log('✅ Order cancelled successfully');
        // Create another order for force-confirm test
        const order2 = await prisma.order.create({
            data: {
                userId: buyer.id,
                status: OrderStatus.PLACED,
                totalAmount: 500,
                items: {
                    create: {
                        sellerId: seller.id,
                        productId: product.id,
                        variantId: variant.id,
                        quantity: 1,
                        priceSnapshot: 650,
                        sellerPriceSnapshot: 500,
                        adminPriceSnapshot: 650,
                        platformMargin: 150,
                    }
                }
            }
        });
        // PUT /v1/admin/orders/:id/force-confirm (SUPER_ADMIN only)
        console.log('Testing PUT /v1/admin/orders/:id/force-confirm...');
        const forceConfirmRes = await fetch(`${API_URL}/admin/orders/${order2.id}/force-confirm`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${superAdminToken}`,
                'Content-Type': 'application/json'
            }
        });
        const forceConfirmData = await forceConfirmRes.json();
        if (!forceConfirmData.message || forceConfirmData.order?.status !== 'CONFIRMED') {
            console.log('Force Confirm Response:', JSON.stringify(forceConfirmData, null, 2));
            throw new Error('Failed to force confirm order');
        }
        console.log('✅ Order force-confirmed successfully');
        // =========================================================================
        // 5. Test Payments & Settlements (Read-only)
        // =========================================================================
        console.log('\n💳 Testing Payments & Settlements...');
        // GET /v1/admin/payments
        console.log('Testing GET /v1/admin/payments...');
        const paymentsRes = await fetch(`${API_URL}/admin/payments`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const paymentsData = await paymentsRes.json();
        if (!paymentsData.payments || !Array.isArray(paymentsData.payments)) {
            throw new Error('Failed to list payments');
        }
        console.log(`✅ Listed ${paymentsData.payments.length} payments`);
        // GET /v1/admin/settlements
        console.log('Testing GET /v1/admin/settlements...');
        const settlementsRes = await fetch(`${API_URL}/admin/settlements`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const settlementsData = await settlementsRes.json();
        if (!settlementsData.settlements || !Array.isArray(settlementsData.settlements)) {
            throw new Error('Failed to list settlements');
        }
        console.log(`✅ Listed ${settlementsData.settlements.length} settlements`);
        // =========================================================================
        // 6. Test Audit Logs
        // =========================================================================
        console.log('\n📋 Testing Audit Logs...');
        // GET /v1/admin/audit-logs
        console.log('Testing GET /v1/admin/audit-logs...');
        const auditRes = await fetch(`${API_URL}/admin/audit-logs`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const auditData = await auditRes.json();
        if (!auditData.auditLogs || !Array.isArray(auditData.auditLogs)) {
            throw new Error('Failed to list audit logs');
        }
        console.log(`✅ Listed ${auditData.auditLogs.length} audit logs`);
        // GET /v1/admin/audit-logs with filters
        console.log('Testing GET /v1/admin/audit-logs with filters...');
        const auditFilterRes = await fetch(`${API_URL}/admin/audit-logs?entityType=USER&entityId=${seller.id}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const auditFilterData = await auditFilterRes.json();
        if (!auditFilterData.auditLogs || auditFilterData.auditLogs.length < 2) {
            throw new Error('Audit logs filter not working');
        }
        console.log(`✅ Filtered audit logs: ${auditFilterData.auditLogs.length} entries`);
        // =========================================================================
        // 7. Test Access Control (ADMIN vs USER)
        // =========================================================================
        console.log('\n🔒 Testing Access Control...');
        // Create regular user token
        const userToken = generateAccessToken({
            userId: buyer.id,
            email: buyer.email,
            phone: null,
            role: buyer.role,
            status: buyer.status,
            isEmailVerified: true,
            isPhoneVerified: false
        });
        // Regular user should be denied
        console.log('Testing unauthorized access...');
        const unauthorizedRes = await fetch(`${API_URL}/admin/sellers`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (unauthorizedRes.status === 200) {
            throw new Error('Access control failed - regular user accessed admin endpoint');
        }
        console.log(`✅ Access control working (status: ${unauthorizedRes.status})`);
        // =========================================================================
        // Done
        // =========================================================================
        console.log('\n🎉 All Admin Service Verification Tests Passed!');
    }
    catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
}
// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyAdmin().then(async () => {
        await prisma.$disconnect();
    }).catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
}
export { verifyAdmin };
//# sourceMappingURL=verify-admin.js.map