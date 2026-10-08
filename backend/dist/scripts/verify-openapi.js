import { openApiSpec } from '../src/docs/openapi.js';
const paths = Object.keys(openApiSpec.paths);
const schemas = Object.keys(openApiSpec.components.schemas);
const tags = openApiSpec.tags.map((t) => t.name);
console.log('=== SPEC SUMMARY ===');
console.log('OpenAPI version:', openApiSpec.openapi);
console.log('API version:', openApiSpec.info.version);
console.log('Total paths:', paths.length);
console.log('Total schemas:', schemas.length);
console.log('Total tags:', tags.length);
console.log('');
console.log('--- NEW SCHEMAS ---');
['Category', 'ProductMedia', 'Review', 'CommissionRule', 'Coupon'].forEach((s) => {
    console.log(`  ${s}: ${schemas.includes(s) ? '✅' : '❌ MISSING'}`);
});
console.log('');
console.log('--- NEW TAGS ---');
['Categories (Admin)', 'Product Media', 'Reviews', 'Reviews (Admin)', 'Commission Rules', 'Coupon Management'].forEach((t) => {
    console.log(`  ${t}: ${tags.includes(t) ? '✅' : '❌ MISSING'}`);
});
console.log('');
console.log('--- PHASE 1 PATHS ---');
const newPaths = [
    '/v1/admin/categories',
    '/v1/admin/categories/{id}',
    '/v1/admin/categories/{id}/toggle',
    '/v1/seller/products/{id}/media',
    '/v1/seller/products/media/{mediaId}',
    '/v1/products/{id}/reviews',
    '/v1/reviews/{id}/helpful',
    '/v1/admin/reviews/{id}/hide',
    '/v1/admin/commission-rules',
    '/v1/admin/commission-rules/{id}',
    '/v1/admin/coupons',
    '/v1/admin/coupons/{id}',
    '/v1/admin/coupons/{id}/toggle',
];
let allOk = true;
newPaths.forEach((p) => {
    if (paths.includes(p)) {
        const methods = Object.keys(openApiSpec.paths?.[p] || {}).join(', ').toUpperCase();
        console.log(`  ✅ ${p}: ${methods}`);
    }
    else {
        console.log(`  ❌ ${p}: MISSING`);
        allOk = false;
    }
});
console.log('');
console.log('--- PRODUCT SCHEMA UPGRADE ---');
const productProps = Object.keys(openApiSpec.components.schemas.Product.properties);
console.log(`  averageRating: ${productProps.includes('averageRating') ? '✅' : '❌ MISSING'}`);
console.log(`  reviewCount: ${productProps.includes('reviewCount') ? '✅' : '❌ MISSING'}`);
console.log(`  images (ProductMedia[]): ${productProps.includes('images') ? '✅' : '❌ MISSING'}`);
console.log('');
if (allOk) {
    console.log('🎉 All Phase 1 endpoints verified!');
}
else {
    console.log('⚠️  Some endpoints are missing. Check above.');
    process.exit(1);
}
//# sourceMappingURL=verify-openapi.js.map