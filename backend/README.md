# KTMONA Backend

Multi-vendor e-commerce backend built with Express, Prisma, and PostgreSQL.

---

## Render Deployment

Use migration-safe commands in Render:

- Build Command: `npm install && npm run build:render`
- Start Command: `npm run start:render`
- Health Check Path: `/health/live`

Do not run `npm run start:render` as the build command. It starts a long-running server process and Render will terminate it during build.

### Virtual Try-On Environment

Set `FASHN_API_KEY` in the backend environment to enable mobile virtual try-on.

Optional tuning:

```bash
FASHN_TRYON_MODEL=tryon-max
FASHN_POLL_INTERVAL_MS=3000
FASHN_POLL_TIMEOUT_MS=115000
```

---

## Payments — Razorpay

Razorpay is the only online gateway (Cash on Delivery needs no gateway).
Checkout places the order (PLACED) and creates a Razorpay order for it; the
order is confirmed only after the payment is captured. Unpaid orders are swept
by `cancelStaleOrders` after 30 minutes, which first asks Razorpay whether the
order was paid, so a lost webhook never cancels a paid order.

```bash
RAZORPAY_KEY_ID=rzp_test_...   # rzp_live_... for real money
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...    # the secret typed into the dashboard webhook
```

**Flow**

1. `POST /v1/checkout?withPayment=1` (or `POST /v1/payments/initiate`) creates
   the Razorpay order (one per KTMONA order, reused on retry) and returns
   `keyId`, `razorpayOrderId`, `amount` (paise) and buyer prefill.
2. The website opens Razorpay Checkout (checkout.js); the app opens the native
   SDK (`react-native-razorpay`).
3. `POST /v1/payments/razorpay/verify` with `orderId`, `razorpayPaymentId`,
   `razorpaySignature` checks the signature, reads the payment back from
   Razorpay (capturing it if only authorized) and confirms the order. With only
   `orderId` it asks Razorpay for the order's payments instead (orders-page
   self-heal).

**Webhook** — register `https://api.ktmona.com/v1/payments/webhook/razorpay`
with `RAZORPAY_WEBHOOK_SECRET`; subscribe to `payment.authorized`,
`payment.captured`, `payment.failed`, `order.paid`, `refund.processed` and
`refund.failed`. Verified as HMAC-SHA256 of the raw body
(`X-Razorpay-Signature`).

**Refunds** — issued via Razorpay's refund API from the cancellation/return
flow. Orders paid through the retired PhonePe / Shiprocket Checkout gateways
are refunded in the ledger only; return that money from the old dashboard.

---

## Cancellation Engine Verification

### Apply Migration

```bash
npx prisma migrate deploy
```

If migration fails due to schema drift, do not use `prisma db push` on databases with existing production data.
Use:

```bash
npx prisma generate
npx prisma migrate status
```

Then resolve migration history with `prisma migrate resolve` only for explicitly reviewed migrations.

### Run Concurrency Test

```bash
npm run verify:cancellation-race
```

### Expected Guarantees

- **Inventory consistency** — stock never goes negative; no duplicate RELEASE movements
- **Idempotent refunds** — refund only fires once per cancellation approval
- **Shipment safety** — shipped orders cannot be cancelled, refunded, or have inventory restored
- **Concurrency-safe cancellation** — row-level locking prevents race conditions between approve, payment, and shipment operations