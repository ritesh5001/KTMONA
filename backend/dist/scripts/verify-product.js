import { request, LOG, ensureSeller, ensureBuyer, ensureAdminToken, prisma } from "./test-utils.js";
import { generateAccessToken, Role } from "../src/utils/jwt.util.js";
async function verifyProduct() {
    LOG.info("Starting Product Variant Verification");
    LOG.step("1. Fetch Categories");
    const categoriesRes = await request("/v1/categories");
    const categoryId = categoriesRes.data?.categories?.[0]?.id;
    if (categoriesRes.status !== 200 || !categoryId) {
        LOG.error("Failed to fetch categories", categoriesRes);
        process.exit(1);
    }
    LOG.success(`Using category ${categoryId}`);
    LOG.step("2. Seller Login");
    const sellerCreds = await ensureSeller();
    const loginRes = await request("/v1/auth/login", "POST", {
        identifier: sellerCreds.email,
        password: sellerCreds.password,
    });
    const sellerToken = loginRes.data?.accessToken;
    if (loginRes.status !== 200 || !sellerToken) {
        LOG.error("Seller login failed", loginRes);
        process.exit(1);
    }
    LOG.success("Seller login successful");
    LOG.step("3. Create Product With Inline Variants");
    const timestamp = Date.now();
    const createProductRes = await request("/v1/seller/products", "POST", {
        categoryId,
        title: `Variant Test Product ${timestamp}`,
        description: "Automated variant verification product",
        isPublished: true,
        images: ["https://example.com/product-main.jpg"],
        variants: [
            {
                size: "M",
                color: "Navy",
                sku: `VAR-${timestamp}-M`,
                sellerPrice: 999,
                compareAtPrice: 1299,
                initialStock: 8,
                images: ["https://example.com/variant-m.jpg"],
            },
            {
                size: "L",
                color: "Navy",
                sku: `VAR-${timestamp}-L`,
                sellerPrice: 1099,
                compareAtPrice: 1399,
                initialStock: 4,
                images: ["https://example.com/variant-l.jpg"],
            },
        ],
    }, sellerToken);
    const product = createProductRes.data?.product;
    const productId = product?.id;
    const sellerVariants = product?.variants ?? [];
    if (createProductRes.status !== 201 || !productId || sellerVariants.length !== 2) {
        LOG.error("Inline variant product creation failed", createProductRes);
        process.exit(1);
    }
    if ("adminListingPrice" in sellerVariants[0]) {
        LOG.error("Seller product response leaked admin price", sellerVariants[0]);
        process.exit(1);
    }
    const navyVariantsAfterCreate = sellerVariants.filter((variant) => variant.color === "Navy");
    if (navyVariantsAfterCreate.length !== 2 ||
        navyVariantsAfterCreate.some((variant) => variant.images?.[0] !== "https://example.com/variant-m.jpg")) {
        LOG.error("Same-color variants did not normalize to one shared gallery", sellerVariants);
        process.exit(1);
    }
    LOG.success(`Product created with ${sellerVariants.length} seller-managed variants`);
    LOG.step("4. Admin Reviews Variants");
    const adminToken = await ensureAdminToken();
    const moderationRes = await request(`/v1/admin/products/${productId}`, "PATCH", {
        variants: sellerVariants.map((variant, index) => ({
            id: variant.id,
            adminListingPrice: index === 0 ? 1199 : null,
            compareAtPrice: index === 0 ? 1499 : 1399,
            status: "APPROVED",
        })),
    }, adminToken);
    if (moderationRes.status !== 200) {
        LOG.error("Admin variant review failed", moderationRes);
        process.exit(1);
    }
    LOG.success("Admin approved variants with mixed pricing");
    LOG.step("5. Verify Public Product Prices");
    const publicListRes = await request("/v1/products");
    const publicProduct = publicListRes.data?.data?.find((item) => item.id === productId);
    if (publicListRes.status !== 200 || !publicProduct) {
        LOG.error("Approved product not found in public listing", publicListRes);
        process.exit(1);
    }
    const detailRes = await request(`/v1/products/${productId}`);
    const publicVariants = detailRes.data?.product?.variants ?? [];
    if (detailRes.status !== 200 || publicVariants.length !== 2) {
        LOG.error("Approved variants missing from public detail", detailRes);
        process.exit(1);
    }
    const mediumVariant = publicVariants.find((variant) => variant.size === "M");
    const largeVariant = publicVariants.find((variant) => variant.size === "L");
    if (!mediumVariant || !largeVariant) {
        LOG.error("Expected sizes are missing from public detail", publicVariants);
        process.exit(1);
    }
    if (mediumVariant.price !== 1199 || largeVariant.price !== 1099) {
        LOG.error("Public prices do not reflect admin-or-seller effective pricing", publicVariants);
        process.exit(1);
    }
    LOG.success("Public detail uses per-variant effective pricing");
    LOG.step("6. Seller Adds A New Pending Variant");
    const addVariantRes = await request(`/v1/seller/products/${productId}/variants`, "POST", {
        size: "XL",
        color: "Navy",
        sku: `VAR-${timestamp}-XL`,
        sellerPrice: 1299,
        compareAtPrice: 1599,
        initialStock: 3,
    }, sellerToken);
    const pendingVariantId = addVariantRes.data?.variant?.id;
    if (addVariantRes.status !== 201 || !pendingVariantId) {
        LOG.error("Seller failed to add new variant", addVariantRes);
        process.exit(1);
    }
    if (addVariantRes.data?.variant?.images?.[0] !== "https://example.com/variant-m.jpg") {
        LOG.error("New size did not inherit the shared color gallery", addVariantRes.data?.variant);
        process.exit(1);
    }
    const detailAfterAddRes = await request(`/v1/products/${productId}`);
    const publicVariantsAfterAdd = detailAfterAddRes.data?.product?.variants ?? [];
    if (publicVariantsAfterAdd.some((variant) => variant.id === pendingVariantId)) {
        LOG.error("Pending variant leaked to storefront", publicVariantsAfterAdd);
        process.exit(1);
    }
    LOG.success("Pending seller-added variant stays hidden from storefront");
    LOG.step("7. Seller Reprices An Approved Variant");
    const repricingRes = await request(`/v1/seller/products/variants/${sellerVariants[0].id}`, "PUT", {
        size: "M",
        color: "Navy",
        sku: `VAR-${timestamp}-M`,
        sellerPrice: 1049,
        compareAtPrice: 1499,
        images: ["https://example.com/variant-m.jpg"],
    }, sellerToken);
    if (repricingRes.status !== 200) {
        LOG.error("Seller variant repricing failed", repricingRes);
        process.exit(1);
    }
    const sellerProductsAfterReprice = await request("/v1/seller/products", "GET", undefined, sellerToken);
    const sellerProductAfterReprice = sellerProductsAfterReprice.data?.products?.find((item) => item.id === productId);
    const navyVariantsAfterReprice = sellerProductAfterReprice?.variants?.filter((variant) => variant.color === "Navy") ?? [];
    if (navyVariantsAfterReprice.length < 2 ||
        navyVariantsAfterReprice.some((variant) => variant.images?.[0] !== "https://example.com/variant-m.jpg")) {
        LOG.error("Same-color gallery drifted after seller variant update", navyVariantsAfterReprice);
        process.exit(1);
    }
    const detailAfterRepriceRes = await request(`/v1/products/${productId}`);
    const publicVariantsAfterReprice = detailAfterRepriceRes.data?.product?.variants ?? [];
    if (publicVariantsAfterReprice.some((variant) => variant.id === sellerVariants[0].id)) {
        LOG.error("Repriced pending variant still appears publicly", publicVariantsAfterReprice);
        process.exit(1);
    }
    LOG.success("Seller pricing edits move only that variant back to pending");
    LOG.step("8. Stock-Only Edit Stays Live");
    const stockUpdateRes = await request(`/v1/seller/products/variants/${sellerVariants[1].id}/stock`, "PUT", { stock: 12 }, sellerToken);
    if (stockUpdateRes.status !== 200 || stockUpdateRes.data?.inventory?.stock !== 12) {
        LOG.error("Stock update failed", stockUpdateRes);
        process.exit(1);
    }
    const detailAfterStockRes = await request(`/v1/products/${productId}`);
    const publicVariantsAfterStock = detailAfterStockRes.data?.product?.variants ?? [];
    const liveVariant = publicVariantsAfterStock.find((variant) => variant.id === sellerVariants[1].id);
    if (!liveVariant) {
        LOG.error("Approved variant disappeared after stock-only edit", publicVariantsAfterStock);
        process.exit(1);
    }
    LOG.success("Stock-only edits keep approved variants live");
    LOG.step("9. Authorization Checks");
    const buyerCreds = await ensureBuyer();
    const buyerLogin = await request("/v1/auth/login", "POST", {
        identifier: buyerCreds.email,
        password: buyerCreds.password,
    });
    const buyerToken = buyerLogin.data?.accessToken;
    const buyerAccessRes = await request("/v1/seller/products", "POST", {
        categoryId,
        title: "Buyer Should Not Create Product",
        variants: [
            {
                size: "Default",
                sku: `BUYER-BLOCK-${timestamp}`,
                sellerPrice: 999,
            },
        ],
    }, buyerToken);
    if (buyerAccessRes.status !== 403) {
        LOG.error("Buyer was able to access seller route", buyerAccessRes);
        process.exit(1);
    }
    LOG.success("Buyer blocked from seller product creation");
    const email2 = `seller2-conflict-${timestamp}@verified.com`;
    const seller2 = await prisma.user.create({
        data: {
            email: email2,
            phone: `88${timestamp.toString().slice(-8)}`,
            passwordHash: "hash",
            status: "ACTIVE",
            role: "SELLER",
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });
    const seller2Token = generateAccessToken({
        userId: seller2.id,
        email: seller2.email,
        phone: seller2.phone,
        role: Role.SELLER,
        status: seller2.status,
        isEmailVerified: true,
        isPhoneVerified: true,
    });
    const unauthorizedUpdate = await request(`/v1/seller/products/${productId}`, "DELETE", undefined, seller2Token);
    if (unauthorizedUpdate.status !== 403) {
        LOG.error("Seller 2 was able to delete seller 1 product", unauthorizedUpdate);
        process.exit(1);
    }
    LOG.success("Seller ownership checks still hold");
    console.log("\n🎉 PRODUCT VARIANT VERIFICATION PASSED");
}
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyProduct()
        .catch(console.error)
        .finally(async () => {
        await prisma.$disconnect();
    });
}
export { verifyProduct };
//# sourceMappingURL=verify-product.js.map