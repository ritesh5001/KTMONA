import { request, LOG, ensureSeller, ensureBuyer, ensureAdminToken, prisma } from './test-utils.js';

async function verifyOrders() {
    LOG.info('Starting Orders Service Verification');

    // 1. Setup: Seller creates product with variant and stock
    LOG.step('1. Setup: Create Product with Stock');

    const categoriesRes = await request('/v1/categories');
    const categoryId = categoriesRes.data.categories?.[0]?.id;
    if (!categoryId) {
        LOG.error('No categories found');
        process.exit(1);
    }

    const sellerCreds = await ensureSeller();
    const sellerLogin = await request('/v1/auth/login', 'POST', {
        identifier: sellerCreds.email,
        password: sellerCreds.password
    });
    const sellerToken = sellerLogin.data.accessToken;

    // Create product
    const productData = {
        categoryId,
        title: `Order Test Product ${Date.now()}`,
        description: 'Product for order testing',
        isPublished: true
    };
    const productRes = await request('/v1/seller/products', 'POST', productData, sellerToken);
    const productId = productRes.data.product?.id;
    if (!productId) {
        LOG.error('Failed to create product', productRes);
        process.exit(1);
    }

    // Create variant with initial stock
    const variantData = {
        sku: `ORDER-SKU-${Date.now()}`,
        price: 750,
        compareAtPrice: 999,
        initialStock: 20
    };
    const variantRes = await request(`/v1/seller/products/${productId}/variants`, 'POST', variantData, sellerToken);
    const variantId = variantRes.data.variant?.id;
    if (!variantId) {
        LOG.error('Failed to create variant', variantRes);
        process.exit(1);
    }

    // Set stock to 20
    await request(`/v1/seller/products/variants/${variantId}/stock`, 'PUT', { stock: 20 }, sellerToken);

    const adminToken = await ensureAdminToken();
    await request(`/v1/admin/products/${productId}/approve`, 'PUT', {}, adminToken);
    await request(`/v1/admin/products/${productId}/set-price`, 'PATCH', { adminListingPrice: 780 }, adminToken);
    LOG.success(`Created product ${productId} with variant ${variantId} (stock: 20)`);

    // 2. Buyer Login and Add to Cart
    LOG.step('2. Buyer Adds Items to Cart');
    const buyerCreds = await ensureBuyer();
    const buyerLogin = await request('/v1/auth/login', 'POST', {
        identifier: buyerCreds.email,
        password: buyerCreds.password
    });
    const buyerToken = buyerLogin.data.accessToken;

    const addItemRes = await request('/v1/cart/items', 'POST', {
        productId,
        variantId,
        quantity: 3
    }, buyerToken);

    if (addItemRes.status === 201) {
        LOG.success('Added 3 items to cart');
    } else {
        LOG.error('Failed to add items to cart', addItemRes);
        process.exit(1);
    }

    // 3. Checkout
    LOG.step('3. Process Checkout');
    const checkoutRes = await request('/v1/checkout', 'POST', {}, buyerToken);

    if (checkoutRes.status === 201 && checkoutRes.data.order?.id) {
        LOG.success(`Order created: ${checkoutRes.data.order.id} (status: ${checkoutRes.data.order.status})`);
    } else {
        LOG.error('Checkout failed', checkoutRes);
        process.exit(1);
    }

    const orderId = checkoutRes.data.order.id;

    // 4. Verify cart is cleared
    LOG.step('4. Verify Cart Cleared After Checkout');
    const cartRes = await request('/v1/cart', 'GET', undefined, buyerToken);
    if (cartRes.data.cart?.items?.length === 0) {
        LOG.success('Cart is empty after checkout');
    } else {
        LOG.error('Cart was not cleared after checkout', cartRes);
        process.exit(1);
    }

    // 5. Verify inventory reduced
    LOG.step('5. Verify Inventory Reduced');
    const productDetail = await request(`/v1/products/${productId}`);
    const variant = productDetail.data.product?.variants?.find((v: any) => v.id === variantId);
    const remainingStock = variant?.inventory?.stock;

    if (remainingStock === 17) { // 20 - 3 = 17
        LOG.success(`Stock correctly reduced: 20 -> ${remainingStock}`);
    } else {
        LOG.error(`Stock not reduced correctly. Expected 17, got ${remainingStock}`, productDetail);
        process.exit(1);
    }

    // 6. Buyer can see their order
    LOG.step('6. Buyer Can View Orders');
    const ordersRes = await request('/v1/orders', 'GET', undefined, buyerToken);
    if (ordersRes.status === 200 && ordersRes.data.orders?.length > 0) {
        const foundOrder = ordersRes.data.orders.find((o: any) => o.id === orderId);
        if (foundOrder) {
            LOG.success('Order visible in buyer\'s order list');
        } else {
            LOG.error('Order not found in buyer\'s list', ordersRes);
            process.exit(1);
        }
    } else {
        LOG.error('Failed to get orders', ordersRes);
        process.exit(1);
    }

    // 7. Buyer can see order detail
    LOG.step('7. Buyer Can View Order Detail');
    const orderDetailRes = await request(`/v1/orders/${orderId}`, 'GET', undefined, buyerToken);
    if (orderDetailRes.status === 200 && orderDetailRes.data.order?.items?.length > 0) {
        LOG.success(`Order detail retrieved with ${orderDetailRes.data.order.items.length} item(s)`);
    } else {
        LOG.error('Failed to get order detail', orderDetailRes);
        process.exit(1);
    }

    // 8. Seller can see their order items
    LOG.step('8. Seller Can View Their Order Items');
    const sellerOrdersRes = await request('/v1/seller/orders', 'GET', undefined, sellerToken);
    if (sellerOrdersRes.status === 200) {
        const sellerItems = sellerOrdersRes.data.orderItems?.filter((item: any) =>
            item.order?.id === orderId
        );
        if (sellerItems && sellerItems.length > 0) {
            LOG.success('Seller can see their items from the order');
        } else {
            LOG.error('Seller cannot see their order items', sellerOrdersRes);
            process.exit(1);
        }
    } else {
        LOG.error('Seller orders request failed', sellerOrdersRes);
        process.exit(1);
    }

    // 9. Seller can view specific order
    LOG.step('9. Seller Can View Specific Order');
    const sellerOrderDetailRes = await request(`/v1/seller/orders/${orderId}`, 'GET', undefined, sellerToken);
    if (sellerOrderDetailRes.status === 200 && sellerOrderDetailRes.data.items?.length > 0) {
        LOG.success('Seller can view their items from specific order');
    } else {
        LOG.error('Seller cannot view specific order', sellerOrderDetailRes);
        process.exit(1);
    }

    // 10. Buyer cannot access seller orders
    LOG.step('10. Authorization: Buyer Cannot Access Seller Orders');
    const buyerSellerOrdersRes = await request('/v1/seller/orders', 'GET', undefined, buyerToken);
    if (buyerSellerOrdersRes.status === 403) {
        LOG.success('Buyer correctly blocked from seller orders');
    } else {
        LOG.error('Buyer was able to access seller orders!', buyerSellerOrdersRes);
        process.exit(1);
    }

    // 11. Seller cannot access buyer orders
    LOG.step('11. Authorization: Seller Cannot Access Buyer Orders');
    const sellerBuyerOrdersRes = await request('/v1/orders', 'GET', undefined, sellerToken);
    if (sellerBuyerOrdersRes.status === 403) {
        LOG.success('Seller correctly blocked from buyer orders');
    } else {
        LOG.error('Seller was able to access buyer orders!', sellerBuyerOrdersRes);
        process.exit(1);
    }

    console.log('\n🎉 ORDERS SERVICE VERIFICATION PASSED');
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyOrders()
        .catch(console.error)
        .finally(async () => {
            await prisma.$disconnect();
        });
}

export { verifyOrders };
