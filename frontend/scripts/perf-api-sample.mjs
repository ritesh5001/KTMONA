import fs from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://api.ktmona.com";
const ITERATIONS = 12;

const CREDENTIALS = {
  admin: { identifier: "rgiri5001@gmail.com", password: "Ritesh5001@" },
  seller: { identifier: "test-seller@verified.com", password: "Password123!" },
  user: { identifier: "test-buyer@verified.com", password: "Password123!" },
};

function q(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const frac = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + frac * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

async function login(role) {
  const payload = CREDENTIALS[role];
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Login failed for ${role}`);
  return res.json();
}

async function getProductId() {
  const res = await fetch(`${API_BASE}/v1/products?limit=1`);
  const json = await res.json();
  return json?.data?.[0]?.id;
}

async function runSamples(endpoint, token) {
  const durations = [];
  const payloads = [];
  const statuses = [];

  for (let i = 0; i < ITERATIONS; i += 1) {
    const started = Date.now();
    const res = await fetch(endpoint.url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const text = await res.text();
    const elapsed = Date.now() - started;
    durations.push(elapsed);
    statuses.push(res.status);

    const headerLen = Number(res.headers.get("content-length") || 0) || 0;
    payloads.push(headerLen || Buffer.byteLength(text, "utf8"));
  }

  return {
    route: endpoint.route,
    endpoint: endpoint.url,
    role: endpoint.role,
    samples: ITERATIONS,
    statusSpread: [...new Set(statuses)],
    latencyMs: {
      p50: Math.round(q(durations, 0.5)),
      p95: Math.round(q(durations, 0.95)),
      avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      max: Math.max(...durations),
      min: Math.min(...durations),
    },
    payloadBytes: {
      p50: Math.round(q(payloads, 0.5)),
      p95: Math.round(q(payloads, 0.95)),
      avg: Math.round(payloads.reduce((a, b) => a + b, 0) / payloads.length),
      max: Math.max(...payloads),
      min: Math.min(...payloads),
    },
  };
}

async function main() {
  const [admin, seller, user] = await Promise.all([
    login("admin"),
    login("seller"),
    login("user"),
  ]);

  const productId = (await getProductId()) || "cmnjzdrid01fnxn50mm0b1va8";

  const endpoints = [
    { route: "/", url: `${API_BASE}/v1/categories`, role: null },
    { route: "/", url: `${API_BASE}/v1/bestsellers?limit=4`, role: null },
    { route: "/", url: `${API_BASE}/v1/products?limit=20`, role: null },
    { route: "/", url: `${API_BASE}/v1/occasions`, role: null },
    { route: "/marketplace", url: `${API_BASE}/v1/products?page=1&limit=9`, role: null },
    { route: "/product/[id]", url: `${API_BASE}/v1/products/${productId}`, role: null },
    { route: "/product/[id]", url: `${API_BASE}/v1/products/${productId}/reviews?page=1&limit=10&sort=newest`, role: null },
    { route: "/product/[id]", url: `${API_BASE}/v1/products/${productId}/related?limit=8`, role: null },
    { route: "/cart", url: `${API_BASE}/v1/cart`, role: "user" },
    { route: "/checkout", url: `${API_BASE}/v1/addresses`, role: "user" },
    { route: "/seller/dashboard", url: `${API_BASE}/v1/seller/analytics/summary`, role: "seller" },
    { route: "/seller/dashboard", url: `${API_BASE}/v1/seller/analytics/revenue-chart?interval=daily`, role: "seller" },
    { route: "/seller/dashboard", url: `${API_BASE}/v1/seller/analytics/top-products?limit=10`, role: "seller" },
    { route: "/seller/dashboard", url: `${API_BASE}/v1/seller/analytics/inventory-health`, role: "seller" },
    { route: "/seller/dashboard", url: `${API_BASE}/v1/seller/analytics/refund-impact`, role: "seller" },
    { route: "/admin/dashboard", url: `${API_BASE}/v1/admin/stats`, role: "admin" },
    { route: "/cart", url: `${API_BASE}/v1/notifications/unread-count`, role: "user" },
    { route: "/cart", url: `${API_BASE}/v1/wishlist/count`, role: "user" },
  ];

  const results = [];
  for (const endpoint of endpoints) {
    const token = endpoint.role === "admin"
      ? admin.accessToken
      : endpoint.role === "seller"
        ? seller.accessToken
        : endpoint.role === "user"
          ? user.accessToken
          : null;

    results.push(await runSamples(endpoint, token));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    sampleCountPerEndpoint: ITERATIONS,
    productId,
    results,
  };

  const outDir = new URL("../perf", import.meta.url).pathname;
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "api-latency-audit.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
