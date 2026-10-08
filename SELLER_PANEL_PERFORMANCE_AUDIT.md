# Seller Panel — Load Time Audit

**Scope:** `frontend/src/app/(seller)/**` and the backend endpoints those pages call.
**Status:** Audit only. No code changed.
**Date:** 2026-08-04

---

## 0. Read this first — the dominant factor is not in the code

Across six separate endpoints measured this session, every one showed the same profile:

| Endpoint | Cold | Warm |
|---|---|---|
| `/v1/bestsellers` | 10.0s | 0.33s |
| `/v1/reels` | 5.3s | 0.41s |
| `/v1/search` | 2.1s | 0.47s |
| `/v1/products/:id/reviews` | 1.9s | 0.34s |
| `/v1/config/shipping` | 1.5s | 0.25s |
| `/v1/products` | 0.45s | 0.31s |

Warm, everything is ~350ms — which is the India ↔ `us-east-1` round trip, not query time.
Cold, it is 1.5–10s. **That gap is Neon waking from a 5-minute autosuspend.**

The seller panel is hit hardest by this because sellers log in a few times a day, so
**almost every seller session starts cold.** A dashboard that fires 5 parallel requests
pays the wake-up once, but every page after it in that session is warm.

> **Highest-value change on this entire list, and it is a console toggle:**
> Neon Console → Branches → `production` → Edit compute → **Autosuspend: never**.
> Nothing below will matter as much. Do this before the code work.

Second-order: database and API are in `us-east-1`, sellers are in India. That is the
~350ms floor under every warm number above. `ap-south-1` would roughly halve it.

---

## 1. Findings ranked by (impact × ease)

### ~~P0 — Seller Orders page: fetched twice~~ — **RETRACTED, this was wrong**

**Correction (verified 2026-08-04):** `useHydratedSWR` already sets
`revalidateOnMount: fallbackData === undefined`, and both the orders and products
pages pass `fallbackData` from their SSR payload. There is **no double-fetch**. I
asserted this from reading the call site without checking the hook. The remaining
suggestion below — a short server-side cache on the two seller endpoints — still
stands on its own merits, but it is P2, not P0.

<details><summary>Original (incorrect) finding</summary>

### P0 — Seller Orders page: two heavy lists, no cache, fetched twice

**Files:** `(seller)/seller/orders/page.tsx`, `orders/page.client.tsx`
**Backend:** `orderRepository.findBySellerId`, `GET /v1/seller/shipments`

The page server-renders `listSellerOrders()` + `listSellerShipments()` in parallel
(good), then `useHydratedSWR` **re-fetches both on mount** to hydrate. So on a cold
backend the seller pays the wake-up twice — once server-side, once client-side.

Neither endpoint is cached server-side. `findBySellerId` is paginated and indexed
(`@@index([sellerId, orderId])`), so the query itself is fine — the cost is the round
trips.

**Suggested fix**
- Give `useHydratedSWR` a `revalidateOnMount: false` (or a `dedupingInterval` longer
  than the render gap) so the SSR payload is trusted for the first paint.
- Add a short server-side cache (60–120s) on `GET /v1/seller/orders` and
  `/v1/seller/shipments`, keyed by `sellerId`, invalidated on shipment/order mutation.
- Confirm `shipments` has a `(seller_id, created_at)` index — it currently only has
  `seller_id` and `status` separately (`schema.prisma:759-761`).

</details>

---

### P0 — Seller Dashboard: 5 uncoordinated client requests, zero SSR

**File:** `(seller)/seller/dashboard/page.tsx`

The dashboard is `"use client"` and fires **five independent `useSWR` calls** on mount:

| SWR key | Endpoint |
|---|---|
| `seller-analytics-summary` | `/v1/seller/analytics/summary` |
| `seller-analytics-chart-*` | `/v1/seller/analytics/revenue-chart` |
| `seller-analytics-top` | `/v1/seller/analytics/top-products` |
| `seller-analytics-inventory` | `/v1/seller/analytics/inventory-health` |
| `seller-analytics-refund` | `/v1/seller/analytics/refund-impact` |

They run in parallel (good) but there is **no server-side prefetch at all**, so the
first paint is five skeletons and the page is entirely gated on the network. This is
the first screen a seller sees after login — i.e. the one guaranteed to be cold.

Backend caching is present (`sellerAnalytics.service.ts`, `CACHE_TTL = 300`), so the
*second* visit within 5 minutes is fast. The problem is exclusively the first.

**Suggested fix**
- Convert `dashboard/page.tsx` into a server component shell that prefetches the
  summary (the only above-the-fold data) and passes it as `fallbackData` to SWR.
  Charts and tables can stay client-side and lazy — they are already `dynamic()`.
- Consider one combined `/v1/seller/analytics/overview` endpoint returning all five
  payloads. Five cold round trips become one. The service already computes them
  independently, so this is assembly, not new logic.
- Raise `CACHE_TTL` from 300s. Analytics does not need 5-minute freshness; 15–30
  minutes would keep far more sessions warm at no real cost to accuracy.

---

### P1 — Seller Reels: 3 requests, and one of them is the full product list

**File:** `(seller)/seller/reels/page.tsx:78-90`

```js
Promise.allSettled([
  listSellerReels(),
  listSellerProducts(),      // ← only needed to populate a picker
  getSellerReelAnalytics(),
])
```

`listSellerProducts()` fetches the seller's **entire product catalogue** on page load,
purely so the "attach a product" dropdown has options. Most visits to this page never
open that dropdown.

**Suggested fix**
- Defer `listSellerProducts()` until the attach-product control is opened.
- Or reuse the SSR product list already fetched by `seller/products/page.tsx` via a
  shared SWR key, so navigating between the two pages hits cache.
- `Reel` is well indexed (`@@index([sellerId])`) — no query work needed.

---

### P1 — Settlements: unbounded-ish list, no pagination, no cache

**Files:** `(seller)/seller/settlements/page.tsx:82-95`, `settlement.repository.ts:7-16`

```ts
async findSettlementsBySellerId(sellerId: string) {
  return prisma.sellerSettlement.findMany({ ..., take: 500 });
}
```

`take: 500` is a safety cap, not pagination. A seller with history pulls up to 500 rows
in one payload and the page renders all of them. There is no server-side cache and no
client cache — a plain `useEffect` + `setLoading(true)` on every mount.

**Suggested fix**
- Paginate (20–50 per page) with the same pattern as orders.
- Add a client cache (SWR/`useHydratedSWR`) so back-navigation is instant.
- Confirm an index on `(seller_id, created_at)` for the ordering.

---

### P1 — Seller Products page.client.tsx is 2,448 lines

**File:** `(seller)/seller/products/page.client.tsx`

Largest file in the panel by a wide margin. It holds the list, the create-product
modal, the variant editor, the colour-gallery uploader and the swatch picker in one
client component. All of it is parsed, downloaded and hydrated before the seller sees
their product list.

The colour swatch picker alone now renders **176 spectrum buttons per variant**.

**Suggested fix**
- Split the create/edit modals into `dynamic()` imports. They are behind a button
  press; they should not be in the initial bundle.
- Lazy-render the spectrum grid behind a "More colours" toggle.
- SSR prefetch is already in place here (`page.tsx` does `Promise.allSettled` of
  categories + products + occasions) — good, keep it.

---

### P2 — `SellerHeader` polls the unread count every 60s on every page

**File:** `frontend/src/components/seller/SellerHeader.tsx:16-30`

```js
getUnreadCount();                       // on mount
setInterval(() => getUnreadCount(), 60_000);
```

Every seller page mounts this header, so there is a `/v1/notifications/unread-count`
request on every navigation plus one per minute forever. It is a cheap query, but it
keeps a connection busy and adds a request to every single page load.

**Suggested fix**
- Move the count into a context/store fetched once per session.
- Or drive it from the existing SSE stream (`/v1/live/events`) instead of polling —
  the infrastructure is already there and already used by the admin panel.

---

### P2 — Appointments and Profile: raw `useEffect` fetches, no cache

**Files:** `(seller)/seller/appointments/page.tsx:49-60`, `profile/page.tsx:18`

Both use bare `useEffect` + `setLoading(true)` with no client cache, so every visit and
every back-navigation is a fresh cold request.

**Suggested fix** — wrap in `useHydratedSWR` like orders/products already do. Low effort,
removes the re-fetch on every return to the page.

---

### P3 — Notifications page double-fetches

**File:** `(seller)/seller/notifications/page.tsx:78`

```js
const [result, count] = await Promise.all([listNotifications(), getUnreadCount()]);
```

Parallel, so not a waterfall — but `getUnreadCount()` is already being fetched by
`SellerHeader` on the same screen. Two requests for the same number.

**Suggested fix** — share it via the store proposed in P2.

---

## 2. Cross-cutting pattern

Three separate slow screens this session traced to the same root cause:
**awaiting something the user is not waiting for.**

- Orders page: cancellations/returns fetched *after* orders instead of alongside.
- Product page: cart write awaited before showing "Added".
- Support thread: read-receipt awaited before hiding the spinner.

**Proposed rule for the codebase:**
> If a request's result does not render, it must not be awaited before first paint.

Worth a lint rule or a code-review checklist item. Every instance found so far has been
a one-line fix with a multi-second payoff.

---

## 3. Status — implemented 2026-08-04

| Item | Status |
|---|---|
| Analytics `CACHE_TTL` 300s → 1200s | ✅ done |
| Reels: defer `listSellerProducts()` to modal open | ✅ done |
| Settlements: `useHydratedSWR` cache | ✅ done |
| Appointments: `useHydratedSWR` cache | ✅ done |
| `SellerHeader`: 60s poll → shared SWR key, 5-min dedupe | ✅ done |
| Notifications: reuse shared unread key | ✅ done |
| Orders double-fetch | ❌ retracted — was not a real bug |
| Dashboard SSR + combined overview endpoint | ⬜ not started |
| Settlements pagination (still `take: 500`) | ⬜ not started |
| Products: `dynamic()` the modals | ⬜ not started |
| Neon autosuspend | ⬜ **still the biggest win, still not done** |

---

## 4. Suggested order of remaining work

| # | Item | Effort | Payoff |
|---|---|---|---|
| 1 | **Neon autosuspend off** | 1 min, console | Removes 1.5–10s from every cold page |
| 2 | Dashboard: SSR the summary + combined overview endpoint | M | First screen after login |
| 3 | Orders: stop double-fetching SSR data | S | Two cold hits → one |
| 4 | Reels: defer the product list | S | One fewer request |
| 5 | Settlements: paginate + cache | M | Scales with seller age |
| 6 | Products: `dynamic()` the modals | M | Bundle/hydration on the biggest file |
| 7 | Unread count: session store or SSE | S | One request off every page |
| 8 | Appointments/Profile: add SWR | S | Instant back-navigation |
| 9 | Raise analytics `CACHE_TTL` to 15–30 min | XS | More sessions warm |
| 10 | Region move to `ap-south-1` | L | Halves the ~350ms warm floor |

---

## 5. What I did not verify

- **No runtime measurements of seller endpoints.** They all require an authenticated
  seller token; the timings in §0 are from public endpoints on the same backend and
  database, so the cold/warm pattern generalises, but per-endpoint seller numbers are
  not measured.
- **No index analysis via `EXPLAIN`.** Index observations come from reading
  `schema.prisma`, not from query plans. The `(seller_id, created_at)` gaps noted for
  `shipments` and settlements are inferred, not proven.
- **No bundle analysis.** The 2,448-line file is flagged on line count and content, not
  on a measured bundle contribution. Worth running `@next/bundle-analyzer` before
  committing to the split in P1.
