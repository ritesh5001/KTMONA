import { request, LOG, ensureSeller, ensureBuyer, ensureAdminToken, prisma } from './test-utils.js';
async function verifyCart() {
    LOG.info('Starting Cart Service Verification');
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
        title: `Cart Test Product ${Date.now()}`,
        description: 'Product for cart testing',
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
        sku: `CART-SKU-${Date.now()}`,
        price: 500,
        compareAtPrice: 600,
        initialStock: 10
    };
    const variantRes = await request(`/v1/seller/products/${productId}/variants`, 'POST', variantData, sellerToken);
    const variantId = variantRes.data.variant?.id;
    if (!variantId) {
        LOG.error('Failed to create variant', variantRes);
        process.exit(1);
    }
    // Update stock to 10
    await request(`/v1/seller/products/variants/${variantId}/stock`, 'PUT', { stock: 10 }, sellerToken);
    const adminToken = await ensureAdminToken();
    await request(`/v1/admin/products/${productId}/approve`, 'PUT', {}, adminToken);
    await request(`/v1/admin/products/${productId}/set-price`, 'PATCH', { adminListingPrice: 550 }, adminToken);
    LOG.success(`Created product ${productId} with variant ${variantId} (stock: 10)`);
    // 2. Buyer Login
    LOG.step('2. Buyer Login');
    const buyerCreds = await ensureBuyer();
    const buyerLogin = await request('/v1/auth/login', 'POST', {
        identifier: buyerCreds.email,
        password: buyerCreds.password
    });
    const buyerToken = buyerLogin.data.accessToken;
    LOG.success('Buyer logged in');
    // 3. Add item to cart
    LOG.step('3. Add Item to Cart');
    const addItemRes = await request('/v1/cart/items', 'POST', {
        productId,
        variantId,
        quantity: 2
    }, buyerToken);
    if (addItemRes.status === 201) {
        LOG.success('Item added to cart');
    }
    else {
        LOG.error('Failed to add item to cart', addItemRes);
        process.exit(1);
    }
    // 4. Get cart
    LOG.step('4. Get Cart');
    const cartRes = await request('/v1/cart', 'GET', undefined, buyerToken);
    if (cartRes.status === 200 && cartRes.data.cart?.items?.length > 0) {
        const cartItem = cartRes.data.cart.items[0];
        LOG.success(`Cart has ${cartRes.data.cart.items.length} item(s), quantity: ${cartItem.quantity}`);
    }
    else {
        LOG.error('Failed to get cart or cart empty', cartRes);
        process.exit(1);
    }
    const cartItemId = cartRes.data.cart.items[0].id;
    // 5. Update quantity
    LOG.step('5. Update Cart Item Quantity');
    const updateRes = await request(`/v1/cart/items/${cartItemId}`, 'PUT', { quantity: 5 }, buyerToken);
    if (updateRes.status === 200) {
        LOG.success('Cart item quantity updated to 5');
    }
    else {
        LOG.error('Failed to update cart item', updateRes);
        process.exit(1);
    }
    // 6. Prevent over-stock
    LOG.step('6. Prevent Over-Stock (requesting 100, only 10 available)');
    const overStockRes = await request(`/v1/cart/items/${cartItemId}`, 'PUT', { quantity: 100 }, buyerToken);
    if (overStockRes.status === 400) {
        LOG.success('Over-stock prevented correctly');
    }
    else {
        LOG.error('Over-stock was NOT prevented!', overStockRes);
        process.exit(1);
    }
    // 7. Seller cannot access cart
    LOG.step('7. Authorization: Seller Cannot Access Cart');
    const sellerCartRes = await request('/v1/cart', 'GET', undefined, sellerToken);
    if (sellerCartRes.status === 403) {
        LOG.success('Seller correctly blocked from cart access');
    }
    else {
        LOG.error('Seller was able to access cart!', sellerCartRes);
        process.exit(1);
    }
    // 8. Remove item from cart
    LOG.step('8. Remove Item from Cart');
    const removeRes = await request(`/v1/cart/items/${cartItemId}`, 'DELETE', undefined, buyerToken);
    if (removeRes.status === 200) {
        LOG.success('Item removed from cart');
    }
    else {
        LOG.error('Failed to remove item', removeRes);
        process.exit(1);
    }
    // Verify cart is empty
    const emptyCartRes = await request('/v1/cart', 'GET', undefined, buyerToken);
    if (emptyCartRes.data.cart?.items?.length === 0) {
        LOG.success('Cart is now empty');
    }
    console.log('\n🎉 CART SERVICE VERIFICATION PASSED');
}
// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyCart()
        .catch(console.error)
        .finally(async () => {
        await prisma.$disconnect();
    });
}
export { verifyCart };
//# sourceMappingURL=verify-cart.js.map