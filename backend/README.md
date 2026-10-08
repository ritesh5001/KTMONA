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

## Payments — PhonePe (Standard Checkout v2)

Checkout places the order (PLACED) and initiates a PhonePe payment; the order
is confirmed only after payment succeeds. Unpaid orders are swept by
`cancelStaleOrders` after 30 minutes.

```bash
PHONEPE_CLIENT_ID=...
PHONEPE_CLIENT_SECRET=...
PHONEPE_CLIENT_VERSION=1
PHONEPE_ENV=SANDBOX            # SANDBOX | PRODUCTION
PHONEPE_WEBHOOK_USERNAME=...   # chosen when configuring the dashboard webhook
PHONEPE_WEBHOOK_PASSWORD=...
FRONTEND_BASE_URL=https://...  # PhonePe redirects buyers to
                              # $FRONTEND_BASE_URL/checkout/phonepe/callback
```

**Flow**

1. `POST /v1/checkout?withPayment=1` (or `POST /v1/payments/initiate`) creates a
   PhonePe order; the response carries `redirectUrl`.
2. The buyer pays on PhonePe and returns to `/checkout/phonepe/callback`
   (web) or the app polls (mobile).
3. `POST /v1/payments/phonepe/verify` confirms the state server-to-server via
   PhonePe's Order Status API before marking the payment SUCCESS and confirming
   the order. Webhooks provide the same confirmation asynchronously.

**Webhook** — register `https://<backend-host>/v1/payments/webhook/phonepe`
with the username/password above; subscribe to `checkout.order.completed` and
`checkout.order.failed`. Verified via `SHA256(username:password)` in the
Authorization header, then re-confirmed against the status API.

**Refunds** — issued via PhonePe's refund API from the cancellation/return flow.

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