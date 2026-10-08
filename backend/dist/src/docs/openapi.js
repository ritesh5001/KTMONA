export const openApiSpec = {
    openapi: "3.1.0",
    info: {
        title: "Tat Vivah Marketplace API",
        description: "Multi-vendor e-commerce marketplace with GST taxation, coupon engine, RMA, cancellations, seller settlements, and personalization.",
        version: "2.0.0",
    },
    servers: [
        {
            url: "http://localhost:3000",
            description: "Local",
        },
    ],
    tags: [
        { name: "Auth", description: "Authentication & session management" },
        { name: "Categories", description: "Product categories" },
        { name: "Products", description: "Public product catalog" },
        { name: "Seller Products", description: "Seller product management" },
        { name: "Cart", description: "Shopping cart operations" },
        { name: "Checkout", description: "Order checkout flow" },
        { name: "Orders (Buyer)", description: "Buyer order management" },
        { name: "Orders (Seller)", description: "Seller order views" },
        { name: "GST & Tax", description: "GST taxation engine" },
        { name: "Coupons", description: "Coupon validation & discount codes" },
        { name: "Invoice", description: "GST-compliant invoice generation" },
        { name: "Cancellation", description: "Order cancellation requests & approval" },
        { name: "Returns (RMA)", description: "Return merchandise authorization workflow" },
        { name: "Refund Ledger", description: "Admin refund tracking" },
        { name: "Payments", description: "Payment records (gateways to be re-added)" },
        { name: "Settlements", description: "Seller settlement tracking" },
        { name: "Seller Commission", description: "Commission & platform fee management" },
        { name: "Seller Settlements", description: "Admin settlement ledger" },
        { name: "Personalization", description: "Recently viewed & product recommendations" },
        { name: "Shipping (Buyer)", description: "Shipment tracking for buyers" },
        { name: "Shipping (Seller)", description: "Seller shipment management" },
        { name: "Shipping (Admin)", description: "Admin shipment overrides" },
        { name: "Notifications (Admin)", description: "Admin notification management" },
        { name: "Notifications (User)", description: "Authenticated user notification inbox" },
        { name: "Addresses", description: "Buyer address book management" },
        { name: "Wishlist", description: "Buyer wishlist operations" },
        { name: "Search", description: "Search, suggest, and trending discovery" },
        { name: "Bestsellers", description: "Public bestseller products" },
        { name: "Categories (Admin)", description: "Admin category CRUD & hierarchy management" },
        { name: "Product Media", description: "Seller product image & video management" },
        { name: "Reviews", description: "Product reviews & ratings" },
        { name: "Reviews (Admin)", description: "Admin review moderation" },
        { name: "Commission Rules", description: "Admin commission & platform fee rules" },
        { name: "Coupon Management", description: "Admin coupon CRUD & lifecycle" },
        { name: "Admin", description: "Admin panel operations" },
        { name: "Seller Analytics", description: "Seller dashboard analytics & KPIs" },
        { name: "Utils", description: "Utility endpoints" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
        schemas: {
            ErrorResponse: {
                type: "object",
                properties: {
                    message: { type: "string" },
                    code: { type: "string" },
                },
            },
            Order: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    userId: { type: "string" },
                    status: {
                        type: "string",
                        enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
                    },
                    totalAmount: { type: "number", description: "Legacy total (backward compat)" },
                    subTotalAmount: { type: "number", description: "Taxable subtotal before GST" },
                    totalTaxAmount: { type: "number", description: "Total GST applied" },
                    grandTotal: {
                        type: "number",
                        description: "Final payable amount after GST and discounts",
                    },
                    couponCode: { type: "string", nullable: true },
                    discountAmount: {
                        type: "number",
                        description: "Total coupon discount applied",
                    },
                    invoiceNumber: { type: "string", nullable: true },
                    invoiceIssuedAt: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                    },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            OrderItem: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    orderId: { type: "string" },
                    productId: { type: "string" },
                    variantId: { type: "string" },
                    quantity: { type: "integer" },
                    priceSnapshot: { type: "number" },
                    taxRate: { type: "number", description: "GST rate applied (e.g. 0.18)" },
                    cgstAmount: { type: "number", description: "Central GST amount" },
                    sgstAmount: { type: "number", description: "State GST amount" },
                    igstAmount: { type: "number", description: "Integrated GST amount" },
                    taxableAmount: { type: "number", description: "Amount before tax" },
                },
            },
            CouponValidation: {
                type: "object",
                properties: {
                    valid: { type: "boolean" },
                    coupon: {
                        type: "object",
                        properties: {
                            code: { type: "string" },
                            type: { type: "string", enum: ["PERCENTAGE", "FLAT"] },
                            value: { type: "number" },
                            maxDiscountAmount: { type: "number", nullable: true },
                            minOrderAmount: { type: "number", nullable: true },
                        },
                    },
                },
            },
            CancellationRequest: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    orderId: { type: "string" },
                    userId: { type: "string" },
                    reason: { type: "string" },
                    status: {
                        type: "string",
                        enum: ["REQUESTED", "APPROVED", "REJECTED"],
                    },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            ReturnRequest: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    orderId: { type: "string" },
                    userId: { type: "string" },
                    reason: { type: "string" },
                    status: {
                        type: "string",
                        enum: ["REQUESTED", "APPROVED", "REJECTED", "INSPECTED", "REFUNDED"],
                    },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            Refund: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    orderId: { type: "string" },
                    amount: { type: "number" },
                    status: { type: "string", enum: ["PENDING", "SUCCESS", "FAILED"] },
                    providerRefundId: { type: "string", nullable: true },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            Settlement: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    orderId: { type: "string" },
                    sellerId: { type: "string" },
                    grossAmount: { type: "number" },
                    commissionAmount: { type: "number" },
                    platformFee: { type: "number" },
                    netAmount: { type: "number" },
                    status: { type: "string", enum: ["PENDING", "SETTLED"] },
                    settledAt: { type: "string", format: "date-time", nullable: true },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            Product: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    categoryId: { type: "string" },
                    sellerId: { type: "string" },
                    isPublished: { type: "boolean" },
                    averageRating: { type: "number", description: "Aggregate average rating (1-5)" },
                    reviewCount: { type: "integer", description: "Total number of reviews" },
                    images: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ProductMedia" },
                        description: "Product media attachments",
                    },
                },
            },
            Category: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    name: { type: "string", example: "Wedding Sherwanis" },
                    slug: { type: "string", example: "wedding-sherwanis", description: "URL-friendly unique slug" },
                    description: { type: "string", nullable: true },
                    image: { type: "string", nullable: true, description: "ImageKit URL" },
                    bannerImage: { type: "string", nullable: true, description: "Category banner ImageKit URL" },
                    parentId: { type: "string", nullable: true, description: "Parent category ID for subcategories" },
                    sortOrder: { type: "integer", default: 0 },
                    isActive: { type: "boolean", default: true },
                    seoTitle: { type: "string", nullable: true },
                    seoDescription: { type: "string", nullable: true },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            ProductMedia: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    productId: { type: "string" },
                    type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                    url: { type: "string", description: "ImageKit URL" },
                    isThumbnail: { type: "boolean", default: false },
                    sortOrder: { type: "integer", default: 0 },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            Review: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    productId: { type: "string" },
                    userId: { type: "string" },
                    rating: { type: "integer", minimum: 1, maximum: 5 },
                    title: { type: "string" },
                    comment: { type: "string" },
                    isVerifiedPurchase: { type: "boolean" },
                    helpfulCount: { type: "integer", default: 0 },
                    isHidden: { type: "boolean", default: false },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            CommissionRule: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    sellerId: { type: "string", nullable: true, description: "Seller-specific override (null = global/category)" },
                    categoryId: { type: "string", nullable: true, description: "Category-specific override (null = global/seller)" },
                    commissionPercent: { type: "number", example: 12.5, description: "Commission percentage (0-100)" },
                    platformFee: { type: "number", example: 25, description: "Fixed platform fee in INR" },
                    isActive: { type: "boolean", default: true },
                    createdAt: { type: "string", format: "date-time" },
                },
                description: "Priority: seller-specific > category-specific > global default",
            },
            Coupon: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    code: { type: "string", example: "WEDDING25", description: "Unique coupon code" },
                    type: { type: "string", enum: ["PERCENTAGE", "FLAT"] },
                    value: { type: "number", description: "Discount value (percent or flat INR)" },
                    maxDiscountAmount: { type: "number", nullable: true, description: "Cap for percentage discounts" },
                    minOrderAmount: { type: "number", nullable: true, description: "Minimum cart value required" },
                    usageLimit: { type: "integer", nullable: true, description: "Max total redemptions allowed" },
                    usedCount: { type: "integer", default: 0 },
                    expiresAt: { type: "string", format: "date-time" },
                    isActive: { type: "boolean", default: true },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
        },
    },
    security: [{ bearerAuth: [] }],
    paths: {
        "/v1/auth/register": {
            post: {
                tags: ["Auth"],
                summary: "Register User",
                security: [], // Public endpoint
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["fullName", "email", "phone", "password"],
                                properties: {
                                    fullName: { type: "string", example: "John Doe" },
                                    email: { type: "string", example: "john@test.com" },
                                    phone: { type: "string", example: "9876543210" },
                                    password: { type: "string", example: "SecurePass123" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "User registered successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "User registered successfully" }
                                    }
                                }
                            }
                        }
                    },
                    "409": {
                        description: "Email or phone already exists",
                    },
                },
            },
        },
        "/v1/auth/admin/register": {
            post: {
                tags: ["Auth"],
                summary: "Register Admin",
                security: [], // Public endpoint
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["firstName", "lastName", "email", "password"],
                                properties: {
                                    firstName: { type: "string", example: "Jane" },
                                    lastName: { type: "string", example: "Smith" },
                                    email: { type: "string", example: "admin@test.com" },
                                    phone: { type: "string", example: "9876543210" },
                                    department: { type: "string", example: "IT" },
                                    designation: { type: "string", example: "Manager" },
                                    password: { type: "string", example: "SecureAdminPass123" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Admin registered successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Admin registered successfully" }
                                    }
                                }
                            }
                        }
                    },
                    "409": {
                        description: "Email or phone already exists",
                    },
                },
            },
        },
        "/v1/seller/register": {
            post: {
                tags: ["Auth"],
                summary: "Register Seller",
                security: [], // Public endpoint
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["email", "phone", "password"],
                                properties: {
                                    email: { type: "string", example: "seller@test.com" },
                                    phone: { type: "string", example: "9876543211" },
                                    password: { type: "string", example: "SecureSellerPass123" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Seller registered successfully (Pending Approval)",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Seller registration submitted for approval" }
                                    }
                                }
                            }
                        }
                    },
                    "409": {
                        description: "Email or phone already exists",
                    },
                },
            },
        },
        "/v1/auth/login": {
            post: {
                tags: ["Auth"],
                summary: "Login",
                security: [], // Public endpoint
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["identifier", "password"],
                                properties: {
                                    identifier: { type: "string", example: "john@test.com" },
                                    password: { type: "string", example: "SecurePass123" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Login successful",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        user: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                email: { type: "string" },
                                                phone: { type: "string" },
                                                role: { type: "string" },
                                                status: { type: "string" }
                                            }
                                        },
                                        accessToken: { type: "string" },
                                        refreshToken: { type: "string" }
                                    }
                                }
                            }
                        }
                    },
                    "401": {
                        description: "Invalid credentials",
                    },
                },
            },
        },
        "/v1/auth/refresh": {
            post: {
                tags: ["Auth"],
                summary: "Refresh Token",
                security: [], // Public endpoint
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["refreshToken"],
                                properties: {
                                    refreshToken: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Token refreshed",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        accessToken: { type: "string" },
                                        refreshToken: { type: "string" }
                                    }
                                }
                            }
                        }
                    },
                    "401": {
                        description: "Invalid refresh token",
                    },
                },
            },
        },
        "/v1/auth/logout": {
            post: {
                tags: ["Auth"],
                summary: "Logout",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Logged out successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Logged out successfully" }
                                    }
                                }
                            }
                        }
                    },
                },
            },
        },
        "/v1/auth/sessions": {
            get: {
                tags: ["Auth"],
                summary: "List active sessions",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Sessions list",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        sessions: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    sessionId: { type: "string" },
                                                    userAgent: { type: "string" },
                                                    ipAddress: { type: "string" },
                                                    createdAt: { type: "string" },
                                                    updatedAt: { type: "string" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                },
            },
        },
        "/v1/auth/sessions/{sessionId}": {
            delete: {
                tags: ["Auth"],
                summary: "Revoke session",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "sessionId",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                    },
                ],
                responses: {
                    "200": {
                        description: "Session revoked",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Session revoked successfully" }
                                    }
                                }
                            }
                        }
                    },
                    "404": {
                        description: "Session not found",
                    },
                },
            },
        },
        // =====================================================================
        // CATEGORY ENDPOINTS (PUBLIC)
        // =====================================================================
        "/v1/categories": {
            get: {
                tags: ["Categories"],
                summary: "List all categories",
                security: [],
                responses: {
                    "200": {
                        description: "Categories list (cached)",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        categories: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    name: { type: "string" },
                                                    slug: { type: "string" },
                                                    isActive: { type: "boolean" },
                                                    createdAt: { type: "string" },
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                },
            },
        },
        // =====================================================================
        // PRODUCT ENDPOINTS (PUBLIC)
        // =====================================================================
        "/v1/products": {
            get: {
                tags: ["Products"],
                summary: "List published products (paginated, cached)",
                security: [],
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                    { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
                    { name: "categoryId", in: "query", schema: { type: "string" } },
                    { name: "search", in: "query", schema: { type: "string" } },
                ],
                responses: {
                    "200": {
                        description: "Paginated products list",
                    },
                },
            },
        },
        "/v1/products/{id}": {
            get: {
                tags: ["Products"],
                summary: "Get product details (cached)",
                security: [],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Product with variants and inventory" },
                    "404": { description: "Product not found" },
                },
            },
        },
        // =====================================================================
        // SELLER PRODUCT ENDPOINTS (PROTECTED)
        // =====================================================================
        "/v1/seller/products": {
            post: {
                tags: ["Seller Products"],
                summary: "Create product (SELLER only)",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["categoryId", "title"],
                                properties: {
                                    categoryId: { type: "string" },
                                    title: { type: "string" },
                                    description: { type: "string" },
                                    isPublished: { type: "boolean", default: false },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Product created" },
                    "400": { description: "Invalid category ID" },
                    "403": { description: "Not a seller" },
                },
            },
            get: {
                tags: ["Seller Products"],
                summary: "List my products (SELLER only)",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "Seller's products" },
                },
            },
        },
        "/v1/seller/products/{id}": {
            put: {
                tags: ["Seller Products"],
                summary: "Update my product (SELLER only)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    categoryId: { type: "string" },
                                    title: { type: "string" },
                                    description: { type: "string" },
                                    isPublished: { type: "boolean" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Product updated" },
                    "403": { description: "Not product owner" },
                },
            },
            delete: {
                tags: ["Seller Products"],
                summary: "Delete my product (SELLER only)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Product deleted" },
                    "403": { description: "Not product owner" },
                },
            },
        },
        "/v1/seller/products/{id}/variants": {
            post: {
                tags: ["Seller Products"],
                summary: "Add variant to product (SELLER only)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["sku", "price"],
                                properties: {
                                    sku: { type: "string" },
                                    price: { type: "number" },
                                    compareAtPrice: { type: "number" },
                                    initialStock: { type: "integer", default: 0 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Variant created" },
                    "403": { description: "Not product owner" },
                    "409": { description: "SKU already exists" },
                },
            },
        },
        "/v1/seller/products/variants/{id}": {
            put: {
                tags: ["Seller Products"],
                summary: "Update variant (SELLER only)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    price: { type: "number" },
                                    compareAtPrice: { type: "number" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Variant updated" },
                    "403": { description: "Not product owner" },
                },
            },
        },
        "/v1/seller/products/variants/{id}/stock": {
            put: {
                tags: ["Seller Products"],
                summary: "Update stock (SELLER only)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["stock"],
                                properties: {
                                    stock: { type: "integer", minimum: 0 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Stock updated" },
                    "403": { description: "Not product owner" },
                },
            },
        },
        // =====================================================================
        // CART ENDPOINTS (BUYER ONLY)
        // =====================================================================
        "/v1/cart": {
            get: {
                tags: ["Cart"],
                summary: "Get shopping cart (cached)",
                description: "Returns the buyer's shopping cart with all items and current prices",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Cart with items",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        cart: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                userId: { type: "string" },
                                                items: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            id: { type: "string" },
                                                            productId: { type: "string" },
                                                            variantId: { type: "string" },
                                                            quantity: { type: "integer" },
                                                            priceSnapshot: { type: "number" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "403": { description: "Not a buyer (USER role required)" },
                },
            },
        },
        "/v1/cart/items": {
            post: {
                tags: ["Cart"],
                summary: "Add item to cart",
                description: "Adds a product variant to cart. Price is snapshotted at add time. Validates stock availability.",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["productId", "variantId", "quantity"],
                                properties: {
                                    productId: { type: "string" },
                                    variantId: { type: "string" },
                                    quantity: { type: "integer", minimum: 1, maximum: 100 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Item added to cart" },
                    "400": { description: "Insufficient stock or invalid data" },
                    "403": { description: "Not a buyer" },
                    "404": { description: "Product or variant not found" },
                },
            },
        },
        "/v1/cart/items/{id}": {
            put: {
                tags: ["Cart"],
                summary: "Update cart item quantity",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["quantity"],
                                properties: {
                                    quantity: { type: "integer", minimum: 1, maximum: 100 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Cart item updated" },
                    "400": { description: "Insufficient stock" },
                    "404": { description: "Cart item not found" },
                },
            },
            delete: {
                tags: ["Cart"],
                summary: "Remove item from cart",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Item removed from cart" },
                    "404": { description: "Cart item not found" },
                },
            },
        },
        // =====================================================================
        // CHECKOUT ENDPOINT
        // =====================================================================
        "/v1/checkout": {
            post: {
                tags: ["Checkout", "GST & Tax"],
                summary: "Process checkout",
                description: "Validates inventory, reserves stock, calculates GST, applies optional coupon, creates order, and clears cart. This is a transactional operation.",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    couponCode: {
                                        type: "string",
                                        description: "Optional coupon code to apply at checkout",
                                    },
                                    addressId: {
                                        type: "string",
                                        description: "Shipping address ID",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Order placed successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        order: { $ref: "#/components/schemas/Order" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Cart empty or insufficient stock" },
                    "403": { description: "Not a buyer" },
                },
            },
        },
        // =====================================================================
        // BUYER ORDER ENDPOINTS
        // =====================================================================
        "/v1/orders": {
            get: {
                tags: ["Orders (Buyer)"],
                summary: "List buyer's orders (cached)",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of orders",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        orders: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    status: { type: "string" },
                                                    totalAmount: { type: "number" },
                                                    createdAt: { type: "string" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/orders/{id}": {
            get: {
                tags: ["Orders (Buyer)"],
                summary: "Get order details (cached)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Order with items" },
                    "404": { description: "Order not found" },
                },
            },
        },
        // =====================================================================
        // SELLER ORDER ENDPOINTS
        // =====================================================================
        "/v1/seller/orders": {
            get: {
                tags: ["Orders (Seller)"],
                summary: "List seller's order items",
                description: "Returns all order items that belong to this seller across all orders",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of order items for seller",
                    },
                    "403": { description: "Not a seller" },
                },
            },
        },
        "/v1/seller/orders/{id}": {
            get: {
                tags: ["Orders (Seller)"],
                summary: "Get seller's view of order",
                description: "Returns only the order items belonging to this seller for a specific order",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Order items belonging to seller" },
                    "403": { description: "No items in this order belong to you" },
                    "404": { description: "Order not found" },
                },
            },
        },
        // =====================================================================
        // PAYMENT ENDPOINTS
        // =====================================================================
        "/v1/payments/{orderId}": {
            get: {
                tags: ["Payments"],
                summary: "Get payment details",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orderId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": {
                        description: "Payment details including status and provider IDs",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                orderId: { type: "string" },
                                                status: { type: "string", enum: ["INITIATED", "PENDING", "SUCCESS", "FAILED"] },
                                                provider: { type: "string" },
                                                providerOrderId: { type: "string" },
                                                providerPaymentId: { type: "string" },
                                                amount: { type: "number" },
                                                currency: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "403": { description: "Unauthorized" },
                    "404": { description: "Payment not found" },
                },
            },
        },
        // =====================================================================
        // SETTLEMENT ENDPOINTS (SELLER)
        // =====================================================================
        "/v1/seller/settlements": {
            get: {
                tags: ["Settlements", "Seller Commission"],
                summary: "List seller settlements",
                description: "Returns settlements for the authenticated seller with commission breakdown.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of settlements",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Settlement" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "403": { description: "Not a seller" },
                },
            },
        },
        // =====================================================================
        // ADMIN ENDPOINTS
        // =====================================================================
        "/v1/admin/sellers": {
            get: {
                tags: ["Admin"],
                summary: "List all sellers",
                description: "List all sellers with their status. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of sellers",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        sellers: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    email: { type: "string" },
                                                    phone: { type: "string" },
                                                    role: { type: "string" },
                                                    status: { type: "string", enum: ["PENDING", "ACTIVE", "SUSPENDED"] },
                                                    createdAt: { type: "string", format: "date-time" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Forbidden - requires ADMIN role" },
                },
            },
        },
        "/v1/admin/sellers/{id}/approve": {
            put: {
                tags: ["Admin"],
                summary: "Approve a pending seller",
                description: "Approves a seller and sets their status to ACTIVE. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: "Seller user ID"
                    }
                ],
                responses: {
                    "200": {
                        description: "Seller approved successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Seller approved successfully" },
                                        seller: { type: "object" }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "Seller is not pending approval" },
                    "404": { description: "Seller not found" },
                },
            },
        },
        "/v1/admin/sellers/{id}/suspend": {
            put: {
                tags: ["Admin"],
                summary: "Suspend a seller",
                description: "Suspends a seller account. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: "Seller user ID"
                    }
                ],
                responses: {
                    "200": {
                        description: "Seller suspended successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Seller suspended successfully" },
                                        seller: { type: "object" }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "Seller is already suspended" },
                    "404": { description: "Seller not found" },
                },
            },
        },
        "/v1/admin/products/pending": {
            get: {
                tags: ["Admin"],
                summary: "List products pending moderation",
                description: "Lists all products waiting for admin approval. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of pending products",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        products: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    title: { type: "string" },
                                                    sellerId: { type: "string" },
                                                    isPublished: { type: "boolean" },
                                                    moderation: {
                                                        type: "object",
                                                        properties: {
                                                            status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
                                                            reason: { type: "string" },
                                                            reviewedAt: { type: "string", format: "date-time" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                },
            },
        },
        "/v1/admin/products/{id}/approve": {
            put: {
                tags: ["Admin"],
                summary: "Approve a product",
                description: "Approves a product and publishes it. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: "Product ID"
                    }
                ],
                responses: {
                    "200": {
                        description: "Product approved and published",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Product approved and published" },
                                        product: { type: "object" }
                                    }
                                }
                            }
                        }
                    },
                    "404": { description: "Product not found" },
                },
            },
        },
        "/v1/admin/products/{id}/reject": {
            put: {
                tags: ["Admin"],
                summary: "Reject a product",
                description: "Rejects a product with a reason. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: "Product ID"
                    }
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["reason"],
                                properties: {
                                    reason: { type: "string", example: "Product violates content policy" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Product rejected",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Product rejected" },
                                        product: { type: "object" }
                                    }
                                }
                            }
                        }
                    },
                    "404": { description: "Product not found" },
                },
            },
        },
        "/v1/admin/orders": {
            get: {
                tags: ["Admin"],
                summary: "List all orders",
                description: "Lists all orders in the system. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of orders",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        orders: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    userId: { type: "string" },
                                                    status: { type: "string" },
                                                    totalAmount: { type: "number" },
                                                    createdAt: { type: "string", format: "date-time" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                },
            },
        },
        "/v1/admin/orders/{id}/cancel": {
            put: {
                tags: ["Admin"],
                summary: "Cancel an order",
                description: "Cancels an order (not for delivered orders). Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: "Order ID"
                    }
                ],
                responses: {
                    "200": {
                        description: "Order cancelled successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Order cancelled successfully" },
                                        order: { type: "object" }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "Cannot cancel delivered order" },
                    "404": { description: "Order not found" },
                },
            },
        },
        "/v1/admin/orders/{id}/force-confirm": {
            put: {
                tags: ["Admin"],
                summary: "Force confirm an order",
                description: "Force confirms an order bypassing payment. Requires SUPER_ADMIN role only.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: "Order ID"
                    }
                ],
                responses: {
                    "200": {
                        description: "Order force-confirmed (payment bypassed)",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Order force-confirmed (payment bypassed)" },
                                        order: { type: "object" }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "Cannot force confirm this order" },
                    "403": { description: "Requires SUPER_ADMIN role" },
                    "404": { description: "Order not found" },
                },
            },
        },
        "/v1/admin/payments": {
            get: {
                tags: ["Admin"],
                summary: "List all payments",
                description: "Lists all payments in the system (read-only). Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of payments",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        payments: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    orderId: { type: "string" },
                                                    amount: { type: "number" },
                                                    status: { type: "string", enum: ["INITIATED", "SUCCESS", "FAILED"] },
                                                    provider: { type: "string" },
                                                    createdAt: { type: "string", format: "date-time" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                },
            },
        },
        "/v1/admin/settlements": {
            get: {
                tags: ["Admin", "Seller Settlements"],
                summary: "List all settlements",
                description: "Lists all seller settlements with commission breakdown. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of settlements",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        settlements: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Settlement" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/admin/audit-logs": {
            get: {
                tags: ["Admin"],
                summary: "List audit logs",
                description: "Lists admin action audit logs with optional filters. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "entityType",
                        in: "query",
                        schema: { type: "string", enum: ["USER", "PRODUCT", "ORDER", "PAYMENT"] },
                        description: "Filter by entity type"
                    },
                    {
                        name: "entityId",
                        in: "query",
                        schema: { type: "string" },
                        description: "Filter by entity ID"
                    },
                    {
                        name: "actorId",
                        in: "query",
                        schema: { type: "string" },
                        description: "Filter by admin user ID who performed the action"
                    },
                    {
                        name: "startDate",
                        in: "query",
                        schema: { type: "string", format: "date-time" },
                        description: "Filter logs after this date"
                    },
                    {
                        name: "endDate",
                        in: "query",
                        schema: { type: "string", format: "date-time" },
                        description: "Filter logs before this date"
                    }
                ],
                responses: {
                    "200": {
                        description: "List of audit logs",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        auditLogs: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    actorId: { type: "string" },
                                                    action: { type: "string" },
                                                    entityType: { type: "string" },
                                                    entityId: { type: "string" },
                                                    metadata: { type: "object" },
                                                    createdAt: { type: "string", format: "date-time" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                },
            },
        },
        // =====================================================================
        // SHIPPING ENDPOINTS
        // =====================================================================
        "/v1/orders/{orderId}/tracking": {
            get: {
                tags: ["Shipping (Buyer)"],
                summary: "Get shipment tracking",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orderId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": {
                        description: "Tracking info",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        orderId: { type: "string" },
                                        status: { type: "string" },
                                        shipments: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    shipmentId: { type: "string" },
                                                    trackingNumber: { type: "string" },
                                                    carrier: { type: "string" },
                                                    status: { type: "string" },
                                                    estimatedDelivery: { type: "string", format: "date-time" },
                                                    events: { type: "array", items: { type: "object" } }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "403": { description: "Not owner of order" },
                },
            },
        },
        "/v1/seller/shipments": {
            get: {
                tags: ["Shipping (Seller)"],
                summary: "List seller's shipments",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "List of shipments" },
                    "403": { description: "Not a seller" },
                },
            },
        },
        "/v1/seller/shipments/{orderId}/create": {
            post: {
                tags: ["Shipping (Seller)"],
                summary: "Create shipment",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orderId", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["carrier", "trackingNumber"],
                                properties: {
                                    carrier: { type: "string" },
                                    trackingNumber: { type: "string" },
                                    estimatedDeliveryDate: { type: "string", format: "date-time" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Shipment created" },
                    "400": { description: "Order not confirmed or all items shipped" },
                },
            },
        },
        "/v1/seller/shipments/{id}/ship": {
            put: {
                tags: ["Shipping (Seller)"],
                summary: "Mark as SHIPPED",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    note: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Status updated to SHIPPED" },
                },
            },
        },
        "/v1/seller/shipments/{id}/deliver": {
            put: {
                tags: ["Shipping (Seller)"],
                summary: "Mark as DELIVERED",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    note: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Status updated to DELIVERED" },
                },
            },
        },
        "/v1/admin/shipments/{id}/override-status": {
            put: {
                tags: ["Shipping (Admin)"],
                summary: "Override shipment status",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["status", "note"],
                                properties: {
                                    status: { type: "string", enum: ["CREATED", "SHIPPED", "DELIVERED", "CANCELLED"] },
                                    note: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Status overridden" },
                    "403": { description: "Not an admin" },
                },
            },
        },
        // =====================================================================
        // ADMIN NOTIFICATION ENDPOINTS
        // =====================================================================
        "/v1/admin/notifications": {
            get: {
                tags: ["Notifications (Admin)"],
                summary: "List notifications",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } }
                ],
                responses: {
                    "200": {
                        description: "List of notifications",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    type: { type: "string" },
                                                    channel: { type: "string" },
                                                    status: { type: "string" },
                                                    userId: { type: "string" },
                                                    subject: { type: "string" },
                                                    content: { type: "string" },
                                                    createdAt: { type: "string", format: "date-time" }
                                                }
                                            }
                                        },
                                        meta: {
                                            type: "object",
                                            properties: {
                                                total: { type: "integer" },
                                                page: { type: "integer" },
                                                limit: { type: "integer" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/v1/admin/notifications/{id}": {
            get: {
                tags: ["Notifications (Admin)"],
                summary: "Get notification details",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } }
                ],
                responses: {
                    "200": {
                        description: "Notification details",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                type: { type: "string" },
                                                content: { type: "string" },
                                                metadata: { type: "object" },
                                                events: { type: "array", items: { type: "object" } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/v1/imagekit/auth": {
            get: {
                tags: ["Utils"],
                summary: "Get ImageKit Authenticator",
                security: [],
                responses: {
                    "200": {
                        description: "ImageKit Auth Parameters",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        token: { type: "string" },
                                        expire: { type: "integer" },
                                        signature: { type: "string" }
                                    }
                                }
                            }
                        }
                    },
                    "500": {
                        description: "ImageKit configuration missing"
                    }
                }
            }
        },
        // =====================================================================
        // INVOICE ENDPOINT
        // =====================================================================
        "/v1/orders/{id}/invoice": {
            get: {
                tags: ["Invoice", "Orders (Buyer)"],
                summary: "Download GST-compliant invoice PDF",
                description: "Generates and returns a GST-compliant invoice PDF for a confirmed or delivered order.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Order ID" },
                ],
                responses: {
                    "200": {
                        description: "GST-compliant invoice PDF",
                        content: {
                            "application/pdf": {
                                schema: { type: "string", format: "binary" },
                            },
                        },
                    },
                    "400": {
                        description: "Invoice not available for this order status",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "403": { description: "Not the order owner" },
                    "404": { description: "Order not found" },
                },
            },
        },
        // =====================================================================
        // COUPON ENDPOINTS
        // =====================================================================
        "/v1/coupons/validate": {
            post: {
                tags: ["Coupons"],
                summary: "Validate a coupon code",
                description: "Validates a coupon code against the buyer's current cart and returns discount preview.",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["code"],
                                properties: {
                                    code: { type: "string", example: "SAVE20" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Coupon validation result",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CouponValidation" },
                            },
                        },
                    },
                    "400": {
                        description: "Invalid or expired coupon",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
        // =====================================================================
        // CANCELLATION ENDPOINTS
        // =====================================================================
        "/v1/cancellations": {
            get: {
                tags: ["Cancellation", "Admin"],
                summary: "List all cancellation requests (Admin)",
                description: "Lists all cancellation requests. Requires ADMIN role.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of cancellation requests",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/CancellationRequest" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "403": { description: "Requires ADMIN role" },
                },
            },
        },
        "/v1/cancellations/{orderId}": {
            post: {
                tags: ["Cancellation"],
                summary: "Request order cancellation (Buyer)",
                description: "Buyer submits a cancellation request for an order.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orderId", in: "path", required: true, schema: { type: "string" }, description: "Order ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["reason"],
                                properties: {
                                    reason: { type: "string", example: "Changed my mind" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Cancellation requested",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CancellationRequest" },
                            },
                        },
                    },
                    "400": {
                        description: "Order cannot be cancelled in current status",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "404": { description: "Order not found" },
                },
            },
        },
        "/v1/cancellations/my": {
            get: {
                tags: ["Cancellation"],
                summary: "List my cancellation requests (Buyer)",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Buyer's cancellation requests",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/CancellationRequest" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/cancellations/{id}/approve": {
            patch: {
                tags: ["Cancellation", "Admin"],
                summary: "Approve cancellation request (Admin)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Cancellation request ID" },
                ],
                responses: {
                    "200": {
                        description: "Cancellation approved — order cancelled, stock restored, refund initiated",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CancellationRequest" },
                            },
                        },
                    },
                    "400": {
                        description: "Already processed",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "404": { description: "Cancellation request not found" },
                },
            },
        },
        "/v1/cancellations/{id}/reject": {
            patch: {
                tags: ["Cancellation", "Admin"],
                summary: "Reject cancellation request (Admin)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Cancellation request ID" },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    reason: { type: "string", example: "Order already shipped" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Cancellation rejected",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CancellationRequest" },
                            },
                        },
                    },
                    "400": {
                        description: "Already processed",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "404": { description: "Cancellation request not found" },
                },
            },
        },
        // =====================================================================
        // RETURNS (RMA) ENDPOINTS
        // =====================================================================
        "/v1/returns": {
            get: {
                tags: ["Returns (RMA)", "Admin"],
                summary: "List all return requests (Admin)",
                description: "Lists all return requests. Requires ADMIN role.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "List of return requests",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/ReturnRequest" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "403": { description: "Requires ADMIN role" },
                },
            },
        },
        "/v1/returns/{orderId}": {
            post: {
                tags: ["Returns (RMA)"],
                summary: "Request return (Buyer)",
                description: "Buyer submits a return merchandise request for a delivered order.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orderId", in: "path", required: true, schema: { type: "string" }, description: "Order ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["reason"],
                                properties: {
                                    reason: { type: "string", example: "Product damaged during shipping" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Return requested",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ReturnRequest" },
                            },
                        },
                    },
                    "400": {
                        description: "Order not eligible for return",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "404": { description: "Order not found" },
                },
            },
        },
        "/v1/returns/my": {
            get: {
                tags: ["Returns (RMA)"],
                summary: "List my return requests (Buyer)",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Buyer's return requests",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/ReturnRequest" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/returns/{id}": {
            get: {
                tags: ["Returns (RMA)"],
                summary: "Get return request details (Buyer)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Return request ID" },
                ],
                responses: {
                    "200": {
                        description: "Return request details",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ReturnRequest" },
                            },
                        },
                    },
                    "404": { description: "Return request not found" },
                },
            },
        },
        "/v1/returns/{id}/approve": {
            patch: {
                tags: ["Returns (RMA)", "Admin"],
                summary: "Approve return request (Admin)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Return request ID" },
                ],
                responses: {
                    "200": {
                        description: "Return approved",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ReturnRequest" },
                            },
                        },
                    },
                    "400": {
                        description: "Already processed",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "404": { description: "Return request not found" },
                },
            },
        },
        "/v1/returns/{id}/reject": {
            patch: {
                tags: ["Returns (RMA)", "Admin"],
                summary: "Reject return request (Admin)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Return request ID" },
                ],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    reason: { type: "string", example: "Return window expired" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Return rejected",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ReturnRequest" },
                            },
                        },
                    },
                    "400": {
                        description: "Already processed",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "404": { description: "Return request not found" },
                },
            },
        },
        "/v1/returns/{id}/refund": {
            post: {
                tags: ["Returns (RMA)", "Refund Ledger", "Admin"],
                summary: "Process refund for approved return (Admin)",
                description: "Initiates the refund for an approved return request.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Return request ID" },
                ],
                responses: {
                    "200": {
                        description: "Refund processed",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        refund: { $ref: "#/components/schemas/Refund" },
                                    },
                                },
                            },
                        },
                    },
                    "400": {
                        description: "Return not in approved status",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "404": { description: "Return request not found" },
                },
            },
        },
        // =====================================================================
        // REFUND LEDGER (ADMIN)
        // =====================================================================
        "/v1/admin/refunds": {
            get: {
                tags: ["Refund Ledger", "Admin"],
                summary: "List all refunds (Admin)",
                description: "Returns the full refund ledger. Requires ADMIN or SUPER_ADMIN role.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Refund ledger",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Refund" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "403": { description: "Requires ADMIN role" },
                },
            },
        },
        // =====================================================================
        // PERSONALIZATION ENDPOINTS
        // =====================================================================
        "/v1/personalization/recommendations": {
            get: {
                tags: ["Personalization"],
                summary: "Get product recommendations",
                description: "Returns personalized product recommendations based on browsing history.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Recommended products",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        products: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Product" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/personalization/recently-viewed": {
            get: {
                tags: ["Personalization"],
                summary: "Get recently viewed products",
                description: "Returns products the buyer has recently viewed.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Recently viewed products",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        products: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Product" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/personalization/recently-viewed/{productId}": {
            post: {
                tags: ["Personalization"],
                summary: "Track product view",
                description: "Records that the buyer viewed a product for personalization.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "productId", in: "path", required: true, schema: { type: "string" }, description: "Product ID" },
                ],
                responses: {
                    "200": {
                        description: "View tracked",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "View recorded" },
                                    },
                                },
                            },
                        },
                    },
                    "404": { description: "Product not found" },
                },
            },
        },
        // =====================================================================
        // DISCOVERY & USER EXPERIENCE ENDPOINTS
        // =====================================================================
        "/v1/bestsellers": {
            get: {
                tags: ["Bestsellers"],
                summary: "List bestseller products",
                security: [],
                responses: {
                    "200": {
                        description: "Bestseller products list",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Product" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/products/{id}/related": {
            get: {
                tags: ["Products", "Search"],
                summary: "Get related products",
                security: [],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Product ID" },
                ],
                responses: {
                    "200": {
                        description: "Related products",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        products: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Product" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/search": {
            get: {
                tags: ["Search"],
                summary: "Search products",
                description: "Full-text product search with sorting and pagination.",
                security: [],
                parameters: [
                    { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Search query" },
                    { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
                    { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
                    { name: "sort", in: "query", required: false, schema: { type: "string" } },
                ],
                responses: {
                    "200": {
                        description: "Search results",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Product" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/search/suggest": {
            get: {
                tags: ["Search"],
                summary: "Get search suggestions",
                security: [],
                parameters: [
                    { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Partial query" },
                    { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 20 } },
                ],
                responses: {
                    "200": {
                        description: "Suggestion list",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        suggestions: { type: "array", items: { type: "string" } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/search/trending": {
            get: {
                tags: ["Search"],
                summary: "Get trending search queries",
                security: [],
                responses: {
                    "200": {
                        description: "Trending query terms",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        queries: { type: "array", items: { type: "string" } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/addresses": {
            get: {
                tags: ["Addresses"],
                summary: "List buyer addresses",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "Address list" },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires USER role" },
                },
            },
            post: {
                tags: ["Addresses"],
                summary: "Create address",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                description: "Address payload",
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Address created" },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires USER role" },
                },
            },
        },
        "/v1/addresses/{addressId}": {
            put: {
                tags: ["Addresses"],
                summary: "Update address",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "addressId", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { type: "object" },
                        },
                    },
                },
                responses: {
                    "200": { description: "Address updated" },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires USER role" },
                    "404": { description: "Address not found" },
                },
            },
            delete: {
                tags: ["Addresses"],
                summary: "Delete address",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "addressId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Address deleted" },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires USER role" },
                    "404": { description: "Address not found" },
                },
            },
        },
        "/v1/addresses/{addressId}/default": {
            patch: {
                tags: ["Addresses"],
                summary: "Set default address",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "addressId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Default address updated" },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires USER role" },
                    "404": { description: "Address not found" },
                },
            },
        },
        "/v1/wishlist": {
            get: {
                tags: ["Wishlist"],
                summary: "List wishlist items",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "Wishlist items" },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires USER role" },
                },
            },
        },
        "/v1/wishlist/count": {
            get: {
                tags: ["Wishlist"],
                summary: "Get wishlist count",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "Wishlist count" },
                    "401": { description: "Unauthorized" },
                },
            },
        },
        "/v1/wishlist/toggle": {
            post: {
                tags: ["Wishlist"],
                summary: "Toggle wishlist item",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["productId"],
                                properties: {
                                    productId: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Wishlist updated" },
                    "401": { description: "Unauthorized" },
                },
            },
        },
        "/v1/wishlist/items": {
            post: {
                tags: ["Wishlist"],
                summary: "Add item to wishlist",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["productId"],
                                properties: {
                                    productId: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Wishlist item added" },
                    "401": { description: "Unauthorized" },
                },
            },
        },
        "/v1/wishlist/check": {
            post: {
                tags: ["Wishlist"],
                summary: "Check wishlist state for products",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    productIds: {
                                        type: "array",
                                        items: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Wishlist check result" },
                    "401": { description: "Unauthorized" },
                },
            },
        },
        "/v1/wishlist/items/{productId}": {
            delete: {
                tags: ["Wishlist"],
                summary: "Remove wishlist item",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "productId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Wishlist item removed" },
                    "401": { description: "Unauthorized" },
                    "404": { description: "Wishlist item not found" },
                },
            },
        },
        "/v1/notifications": {
            get: {
                tags: ["Notifications (User)"],
                summary: "List user notifications",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "Paginated notifications" },
                    "401": { description: "Unauthorized" },
                },
            },
        },
        "/v1/notifications/unread-count": {
            get: {
                tags: ["Notifications (User)"],
                summary: "Get unread notification count",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "Unread count" },
                    "401": { description: "Unauthorized" },
                },
            },
        },
        "/v1/notifications/{id}/read": {
            patch: {
                tags: ["Notifications (User)"],
                summary: "Mark notification as read",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Notification marked as read" },
                    "401": { description: "Unauthorized" },
                    "404": { description: "Notification not found" },
                },
            },
        },
        // ── Seller Analytics ──────────────────────────────────────────────
        "/v1/seller/analytics/summary": {
            get: {
                tags: ["Seller Analytics"],
                summary: "Dashboard summary KPIs",
                description: "Returns revenue, orders, units sold, refund rate, cancellation rate, etc. for the authenticated seller.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "startDate", in: "query", required: false, schema: { type: "string", format: "date-time" }, description: "ISO start date" },
                    { name: "endDate", in: "query", required: false, schema: { type: "string", format: "date-time" }, description: "ISO end date" },
                ],
                responses: {
                    "200": {
                        description: "Summary data",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "object",
                                            properties: {
                                                totalRevenue: { type: "number" },
                                                totalOrders: { type: "number" },
                                                totalUnitsSold: { type: "number" },
                                                averageOrderValue: { type: "number" },
                                                totalRefundAmount: { type: "number" },
                                                netRevenue: { type: "number" },
                                                returnRate: { type: "number" },
                                                cancellationRate: { type: "number" },
                                                conversionRate: { type: "number" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Forbidden — SELLER role required" },
                    "429": { description: "Rate limit exceeded" },
                },
            },
        },
        "/v1/seller/analytics/revenue-chart": {
            get: {
                tags: ["Seller Analytics"],
                summary: "Revenue over time chart data",
                description: "Returns time-series revenue data grouped by daily, weekly, or monthly intervals.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "interval", in: "query", required: false, schema: { type: "string", enum: ["daily", "weekly", "monthly"], default: "daily" } },
                ],
                responses: {
                    "200": {
                        description: "Chart points",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    date: { type: "string" },
                                                    revenue: { type: "number" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Forbidden" },
                },
            },
        },
        "/v1/seller/analytics/top-products": {
            get: {
                tags: ["Seller Analytics"],
                summary: "Top selling products",
                description: "Returns top N products by units sold with revenue, return count, and average rating.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "limit", in: "query", required: false, schema: { type: "integer", default: 10, minimum: 1, maximum: 50 } },
                ],
                responses: {
                    "200": {
                        description: "Top products list",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    productId: { type: "string" },
                                                    title: { type: "string" },
                                                    image: { type: "string", nullable: true },
                                                    unitsSold: { type: "number" },
                                                    revenue: { type: "number" },
                                                    returnCount: { type: "number" },
                                                    ratingAverage: { type: "number" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Forbidden" },
                },
            },
        },
        "/v1/seller/analytics/inventory-health": {
            get: {
                tags: ["Seller Analytics"],
                summary: "Inventory health overview",
                description: "Returns low stock count, out of stock count, total variants, and fast-moving products.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Inventory health data",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "object",
                                            properties: {
                                                lowStockProducts: { type: "number" },
                                                outOfStockProducts: { type: "number" },
                                                totalVariants: { type: "number" },
                                                fastMovingProducts: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            productId: { type: "string" },
                                                            title: { type: "string" },
                                                            image: { type: "string", nullable: true },
                                                            unitsSold: { type: "number" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Forbidden" },
                },
            },
        },
        "/v1/seller/analytics/refund-impact": {
            get: {
                tags: ["Seller Analytics"],
                summary: "Refund impact analysis",
                description: "Returns total refund count, revenue impact in rupees, and top returned products.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "startDate", in: "query", required: false, schema: { type: "string", format: "date-time" } },
                    { name: "endDate", in: "query", required: false, schema: { type: "string", format: "date-time" } },
                ],
                responses: {
                    "200": {
                        description: "Refund impact data",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        data: {
                                            type: "object",
                                            properties: {
                                                totalRefunds: { type: "number" },
                                                refundRevenueImpact: { type: "number" },
                                                mostReturnedProducts: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            productId: { type: "string" },
                                                            title: { type: "string" },
                                                            returnCount: { type: "number" },
                                                            refundAmount: { type: "number" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Forbidden" },
                },
            },
        },
        // =================================================================
        // CATEGORY CRUD (ADMIN)
        // =================================================================
        "/v1/admin/categories": {
            get: {
                tags: ["Categories (Admin)"],
                summary: "List all categories (Admin)",
                description: "Returns all categories including inactive ones. Supports tree/flat view. Requires ADMIN or SUPER_ADMIN.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "includeInactive", in: "query", required: false, schema: { type: "boolean", default: false }, description: "Include inactive categories" },
                    { name: "parentId", in: "query", required: false, schema: { type: "string" }, description: "Filter by parent category" },
                ],
                responses: {
                    "200": {
                        description: "Category list",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        categories: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Category" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                },
            },
            post: {
                tags: ["Categories (Admin)"],
                summary: "Create category",
                description: "Creates a new product category. Slug must be unique. parentId must reference an existing category.",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["name", "slug"],
                                properties: {
                                    name: { type: "string", example: "Wedding Sherwanis" },
                                    slug: { type: "string", example: "wedding-sherwanis" },
                                    description: { type: "string" },
                                    image: { type: "string", description: "ImageKit URL" },
                                    bannerImage: { type: "string", description: "Banner ImageKit URL" },
                                    parentId: { type: "string", description: "Parent category ID (for subcategories)" },
                                    sortOrder: { type: "integer", default: 0 },
                                    isActive: { type: "boolean", default: true },
                                    seoTitle: { type: "string" },
                                    seoDescription: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Category created",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Category created" },
                                        category: { $ref: "#/components/schemas/Category" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "409": { description: "Slug already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                },
            },
        },
        "/v1/admin/categories/{id}": {
            put: {
                tags: ["Categories (Admin)"],
                summary: "Update category",
                description: "Updates an existing category. Slug uniqueness is enforced. parentId must reference a valid category.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Category ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    slug: { type: "string" },
                                    description: { type: "string", nullable: true },
                                    image: { type: "string", nullable: true },
                                    bannerImage: { type: "string", nullable: true },
                                    parentId: { type: "string", nullable: true },
                                    sortOrder: { type: "integer" },
                                    isActive: { type: "boolean" },
                                    seoTitle: { type: "string", nullable: true },
                                    seoDescription: { type: "string", nullable: true },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Category updated",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Category updated" },
                                        category: { $ref: "#/components/schemas/Category" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Category not found" },
                    "409": { description: "Slug conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                },
            },
            delete: {
                tags: ["Categories (Admin)"],
                summary: "Delete category",
                description: "Deletes a category. Fails if products are assigned to this category.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Category ID" },
                ],
                responses: {
                    "200": {
                        description: "Category deleted",
                        content: { "application/json": { schema: { type: "object", properties: { message: { type: "string", example: "Category deleted" } } } } },
                    },
                    "400": { description: "Cannot delete — products exist in this category", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Category not found" },
                },
            },
        },
        "/v1/admin/categories/{id}/toggle": {
            patch: {
                tags: ["Categories (Admin)"],
                summary: "Toggle category active state",
                description: "Toggles isActive flag. Deactivating hides from public catalog but preserves data.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Category ID" },
                ],
                responses: {
                    "200": {
                        description: "Category toggled",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Category deactivated" },
                                        category: { $ref: "#/components/schemas/Category" },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Category not found" },
                },
            },
        },
        // =================================================================
        // PRODUCT MEDIA SYSTEM (SELLER)
        // =================================================================
        "/v1/seller/products/{id}/media": {
            post: {
                tags: ["Product Media", "Seller Products"],
                summary: "Upload product media",
                description: "Attaches an image or video to a product. Only the owning seller can add media. Only one thumbnail is allowed per product.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Product ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["type", "url"],
                                properties: {
                                    type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                                    url: { type: "string", description: "ImageKit URL" },
                                    isThumbnail: { type: "boolean", default: false },
                                    sortOrder: { type: "integer", default: 0 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Media uploaded",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Media added" },
                                        media: { $ref: "#/components/schemas/ProductMedia" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error (e.g. duplicate thumbnail)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires SELLER role / not product owner" },
                    "404": { description: "Product not found" },
                },
            },
        },
        "/v1/seller/products/media/{mediaId}": {
            put: {
                tags: ["Product Media", "Seller Products"],
                summary: "Update product media",
                description: "Updates media metadata (sort order, thumbnail flag, type). Only owning seller can modify.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "mediaId", in: "path", required: true, schema: { type: "string" }, description: "Media ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                                    url: { type: "string" },
                                    isThumbnail: { type: "boolean" },
                                    sortOrder: { type: "integer" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Media updated",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Media updated" },
                                        media: { $ref: "#/components/schemas/ProductMedia" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires SELLER role / not product owner" },
                    "404": { description: "Media not found" },
                },
            },
            delete: {
                tags: ["Product Media", "Seller Products"],
                summary: "Delete product media",
                description: "Removes a media attachment from a product. Only owning seller can delete.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "mediaId", in: "path", required: true, schema: { type: "string" }, description: "Media ID" },
                ],
                responses: {
                    "200": {
                        description: "Media deleted",
                        content: { "application/json": { schema: { type: "object", properties: { message: { type: "string", example: "Media deleted" } } } } },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires SELLER role / not product owner" },
                    "404": { description: "Media not found" },
                },
            },
        },
        // =================================================================
        // REVIEW SYSTEM
        // =================================================================
        "/v1/products/{id}/reviews": {
            post: {
                tags: ["Reviews"],
                summary: "Create product review",
                description: "Submits a review for a delivered product. One review per order item. Updates product averageRating and reviewCount.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Product ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["rating", "title", "comment"],
                                properties: {
                                    rating: { type: "integer", minimum: 1, maximum: 5, example: 4 },
                                    title: { type: "string", example: "Excellent quality sherwani" },
                                    comment: { type: "string", example: "Fabric quality is superb, fits perfectly for wedding." },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Review created",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Review submitted" },
                                        review: { $ref: "#/components/schemas/Review" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error (e.g. product not delivered, already reviewed)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires USER role" },
                    "404": { description: "Product not found" },
                },
            },
            get: {
                tags: ["Reviews"],
                summary: "Get product reviews",
                description: "Returns paginated reviews for a product. Public endpoint.",
                security: [],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Product ID" },
                    { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
                    { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
                    { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["newest", "oldest", "highest", "lowest", "helpful"] }, description: "Sort order" },
                ],
                responses: {
                    "200": {
                        description: "Review list with aggregation",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        reviews: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Review" },
                                        },
                                        pagination: {
                                            type: "object",
                                            properties: {
                                                page: { type: "integer" },
                                                limit: { type: "integer" },
                                                total: { type: "integer" },
                                                totalPages: { type: "integer" },
                                            },
                                        },
                                        summary: {
                                            type: "object",
                                            properties: {
                                                averageRating: { type: "number" },
                                                totalReviews: { type: "integer" },
                                                ratingDistribution: {
                                                    type: "object",
                                                    properties: {
                                                        "1": { type: "integer" },
                                                        "2": { type: "integer" },
                                                        "3": { type: "integer" },
                                                        "4": { type: "integer" },
                                                        "5": { type: "integer" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "404": { description: "Product not found" },
                },
            },
        },
        "/v1/reviews/{id}/helpful": {
            post: {
                tags: ["Reviews"],
                summary: "Mark review as helpful",
                description: "Increments the helpfulCount for a review. Requires authenticated user.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Review ID" },
                ],
                responses: {
                    "200": {
                        description: "Helpful count updated",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Marked as helpful" },
                                        helpfulCount: { type: "integer" },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "404": { description: "Review not found" },
                },
            },
        },
        "/v1/admin/reviews/{id}/hide": {
            patch: {
                tags: ["Reviews (Admin)"],
                summary: "Hide/unhide review",
                description: "Toggles the isHidden flag on a review. Hidden reviews are excluded from public listing. Requires ADMIN or SUPER_ADMIN.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Review ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["isHidden"],
                                properties: {
                                    isHidden: { type: "boolean", example: true },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Review visibility updated",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Review hidden" },
                                        review: { $ref: "#/components/schemas/Review" },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Review not found" },
                },
            },
        },
        // =================================================================
        // COMMISSION MANAGEMENT (ADMIN)
        // =================================================================
        "/v1/admin/commission-rules": {
            get: {
                tags: ["Commission Rules"],
                summary: "List commission rules",
                description: "Returns all commission rules ordered by priority: seller-specific → category-specific → global default. Requires ADMIN or SUPER_ADMIN.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "sellerId", in: "query", required: false, schema: { type: "string" }, description: "Filter by seller" },
                    { name: "categoryId", in: "query", required: false, schema: { type: "string" }, description: "Filter by category" },
                    { name: "isActive", in: "query", required: false, schema: { type: "boolean" }, description: "Filter by active state" },
                ],
                responses: {
                    "200": {
                        description: "Commission rules list",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        rules: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/CommissionRule" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                },
            },
            post: {
                tags: ["Commission Rules"],
                summary: "Create commission rule",
                description: "Creates a new commission rule. Only one active global rule (no sellerId/categoryId) is allowed. Duplicate seller+category combinations are rejected.",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["commissionPercent", "platformFee"],
                                properties: {
                                    sellerId: { type: "string", description: "Seller-specific rule" },
                                    categoryId: { type: "string", description: "Category-specific rule" },
                                    commissionPercent: { type: "number", minimum: 0, maximum: 100, example: 12.5 },
                                    platformFee: { type: "number", minimum: 0, example: 25 },
                                    isActive: { type: "boolean", default: true },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Commission rule created",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Commission rule created" },
                                        rule: { $ref: "#/components/schemas/CommissionRule" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "409": { description: "Duplicate rule conflict (seller/category combination exists)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                },
            },
        },
        "/v1/admin/commission-rules/{id}": {
            put: {
                tags: ["Commission Rules"],
                summary: "Update commission rule",
                description: "Updates an existing commission rule. Validates uniqueness constraints.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Commission rule ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    sellerId: { type: "string", nullable: true },
                                    categoryId: { type: "string", nullable: true },
                                    commissionPercent: { type: "number", minimum: 0, maximum: 100 },
                                    platformFee: { type: "number", minimum: 0 },
                                    isActive: { type: "boolean" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Commission rule updated",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Commission rule updated" },
                                        rule: { $ref: "#/components/schemas/CommissionRule" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Commission rule not found" },
                    "409": { description: "Duplicate rule conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                },
            },
            delete: {
                tags: ["Commission Rules"],
                summary: "Delete commission rule",
                description: "Deletes a commission rule. The last active global rule cannot be deleted.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Commission rule ID" },
                ],
                responses: {
                    "200": {
                        description: "Commission rule deleted",
                        content: { "application/json": { schema: { type: "object", properties: { message: { type: "string", example: "Commission rule deleted" } } } } },
                    },
                    "400": { description: "Cannot delete last active global rule", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Commission rule not found" },
                },
            },
        },
        // =================================================================
        // COUPON MANAGEMENT (ADMIN CRUD)
        // =================================================================
        "/v1/admin/coupons": {
            get: {
                tags: ["Coupon Management"],
                summary: "List all coupons (Admin)",
                description: "Returns all coupons with usage stats. Expired coupons are auto-flagged. Requires ADMIN or SUPER_ADMIN.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "isActive", in: "query", required: false, schema: { type: "boolean" }, description: "Filter active/inactive" },
                    { name: "type", in: "query", required: false, schema: { type: "string", enum: ["PERCENTAGE", "FLAT"] } },
                    { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
                    { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
                ],
                responses: {
                    "200": {
                        description: "Coupon list",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        coupons: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Coupon" },
                                        },
                                        pagination: {
                                            type: "object",
                                            properties: {
                                                page: { type: "integer" },
                                                limit: { type: "integer" },
                                                total: { type: "integer" },
                                                totalPages: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                },
            },
            post: {
                tags: ["Coupon Management"],
                summary: "Create coupon",
                description: "Creates a new coupon code. Code must be unique. expiresAt determines auto-disable.",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["code", "type", "value", "expiresAt"],
                                properties: {
                                    code: { type: "string", example: "WEDDING25" },
                                    type: { type: "string", enum: ["PERCENTAGE", "FLAT"] },
                                    value: { type: "number", example: 25 },
                                    maxDiscountAmount: { type: "number", nullable: true, example: 500, description: "Cap for percentage discounts" },
                                    minOrderAmount: { type: "number", nullable: true, example: 1000, description: "Minimum cart value" },
                                    usageLimit: { type: "integer", nullable: true, example: 100, description: "Maximum total redemptions" },
                                    expiresAt: { type: "string", format: "date-time", example: "2026-12-31T23:59:59Z" },
                                    isActive: { type: "boolean", default: true },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Coupon created",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Coupon created" },
                                        coupon: { $ref: "#/components/schemas/Coupon" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "409": { description: "Coupon code already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                },
            },
        },
        "/v1/admin/coupons/{id}": {
            put: {
                tags: ["Coupon Management"],
                summary: "Update coupon",
                description: "Updates coupon details. Code uniqueness is enforced.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Coupon ID" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    code: { type: "string" },
                                    type: { type: "string", enum: ["PERCENTAGE", "FLAT"] },
                                    value: { type: "number" },
                                    maxDiscountAmount: { type: "number", nullable: true },
                                    minOrderAmount: { type: "number", nullable: true },
                                    usageLimit: { type: "integer", nullable: true },
                                    expiresAt: { type: "string", format: "date-time" },
                                    isActive: { type: "boolean" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Coupon updated",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Coupon updated" },
                                        coupon: { $ref: "#/components/schemas/Coupon" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Coupon not found" },
                    "409": { description: "Code conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                },
            },
            delete: {
                tags: ["Coupon Management"],
                summary: "Delete coupon",
                description: "Deletes a coupon. Cannot delete if usedCount > 0.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Coupon ID" },
                ],
                responses: {
                    "200": {
                        description: "Coupon deleted",
                        content: { "application/json": { schema: { type: "object", properties: { message: { type: "string", example: "Coupon deleted" } } } } },
                    },
                    "400": { description: "Cannot delete — coupon has been used", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Coupon not found" },
                },
            },
        },
        "/v1/admin/coupons/{id}/toggle": {
            patch: {
                tags: ["Coupon Management"],
                summary: "Toggle coupon active state",
                description: "Enables or disables a coupon without deleting it. Expired coupons cannot be re-enabled.",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Coupon ID" },
                ],
                responses: {
                    "200": {
                        description: "Coupon toggled",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string", example: "Coupon deactivated" },
                                        coupon: { $ref: "#/components/schemas/Coupon" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Cannot re-enable expired coupon", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    "401": { description: "Unauthorized" },
                    "403": { description: "Requires ADMIN or SUPER_ADMIN role" },
                    "404": { description: "Coupon not found" },
                },
            },
        },
    },
};
//# sourceMappingURL=openapi.js.map