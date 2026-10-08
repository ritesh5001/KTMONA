import fs from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "playwright";

const API_BASE = "https://api.ktmona.com";
const APP_BASE = "http://localhost:3010";

const CREDENTIALS = {
  admin: { identifier: "rgiri5001@gmail.com", password: "Ritesh5001@" },
  seller: { identifier: "test-seller@verified.com", password: "Password123!" },
  user: { identifier: "test-buyer@verified.com", password: "Password123!" },
};

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function toKb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

function cleanUrl(raw) {
  try {
    const u = new URL(raw);
    const qs = [...u.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `${u.origin}${u.pathname}${qs ? `?${qs}` : ""}`;
  } catch {
    return raw;
  }
}

async function login(role) {
  const payload = CREDENTIALS[role];
  const response = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Login failed for ${role}`);
  return response.json();
}

function authCookies(session) {
  const { accessToken, refreshToken, user } = session;
  return [
    {
      name: "ktmona_access",
      value: accessToken,
      url: APP_BASE,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "ktmona_refresh",
      value: refreshToken,
      url: APP_BASE,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "ktmona_role",
      value: user.role,
      url: APP_BASE,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "ktmona_user",
      value: encodeURIComponent(JSON.stringify(user)),
      url: APP_BASE,
      secure: false,
      sameSite: "Lax",
    },
  ];
}

async function getProductId() {
  const response = await fetch(`${API_BASE}/v1/products?limit=1`);
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data?.[0]?.id ?? null;
}

function cacheBucket(headers = {}) {
  const cc = String(headers["cache-control"] || "").toLowerCase();
  if (!cc) return "missing";
  if (cc.includes("immutable") || cc.includes("max-age=31536000")) return "strong";
  if (cc.includes("max-age=86400") || cc.includes("stale-while-revalidate")) return "good";
  return "weak";
}

async function main() {
  const [adminSession, sellerSession, userSession] = await Promise.all([
    login("admin"),
    login("seller"),
    login("user"),
  ]);

  const productId = (await getProductId()) || "cmnjz6kut0013xnsyvnklgo0b";

  const routes = [
    { route: "/", url: `${APP_BASE}/`, auth: "none" },
    { route: "/marketplace", url: `${APP_BASE}/marketplace`, auth: "none" },
    { route: "/search", url: `${APP_BASE}/search?q=kurta`, auth: "none" },
    { route: "/product/[id]", url: `${APP_BASE}/product/${productId}`, auth: "none" },
    { route: "/cart", url: `${APP_BASE}/cart`, auth: "user" },
    { route: "/checkout", url: `${APP_BASE}/checkout`, auth: "user" },
    { route: "/seller/dashboard", url: `${APP_BASE}/seller/dashboard`, auth: "seller" },
    { route: "/admin/dashboard", url: `${APP_BASE}/admin/dashboard`, auth: "admin" },
  ];

  const browser = await chromium.launch({ headless: true });
  const output = { generatedAt: new Date().toISOString(), productId, routes: [] };

  for (const cfg of routes) {
    const context = await browser.newContext({ ...devices["Pixel 5"], ignoreHTTPSErrors: true });
    if (cfg.auth === "user") await context.addCookies(authCookies(userSession));
    if (cfg.auth === "seller") await context.addCookies(authCookies(sellerSession));
    if (cfg.auth === "admin") await context.addCookies(authCookies(adminSession));

    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__perfAudit = { lcp: 0, cls: 0, maxEventDuration: 0, longTasks: [] };
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) window.__perfAudit.lcp = last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__perfAudit.cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > window.__perfAudit.maxEventDuration) {
              window.__perfAudit.maxEventDuration = entry.duration;
            }
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__perfAudit.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {}
    });

    const starts = new Map();
    const records = [];

    page.on("request", (request) => starts.set(request, Date.now()));
    page.on("response", async (response) => {
      const request = response.request();
      const started = starts.get(request) || Date.now();
      const durationMs = Date.now() - started;
      const headers = await response.allHeaders();
      records.push({
        url: response.url(),
        normalizedUrl: cleanUrl(response.url()),
        status: response.status(),
        method: request.method(),
        resourceType: request.resourceType(),
        durationMs,
        contentLength: Number(headers["content-length"] || 0) || 0,
        headers,
      });
    });

    const startWall = Date.now();
    await page.goto(cfg.url, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(2500);

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const vpH = window.innerHeight;
      const imgs = Array.from(document.images).map((img) => {
        const rect = img.getBoundingClientRect();
        return {
          src: img.currentSrc || img.src,
          loading: img.loading || "eager",
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0,
          aboveFold: rect.top < vpH && rect.bottom > 0,
        };
      });
      return {
        nav: {
          ttfb: nav ? nav.responseStart : 0,
          dcl: nav ? nav.domContentLoadedEventEnd : 0,
          load: nav ? nav.loadEventEnd : 0,
        },
        vitals: window.__perfAudit,
        images: imgs,
      };
    });

    const ok = records.filter((r) => r.status > 0);
    const payloadBytes = ok.reduce((s, r) => s + r.contentLength, 0);

    const dupMap = new Map();
    for (const r of ok) dupMap.set(r.normalizedUrl, (dupMap.get(r.normalizedUrl) || 0) + 1);
    const duplicateRequests = [...dupMap.entries()]
      .filter(([, c]) => c > 1)
      .map(([url, count]) => ({ url, count }))
      .slice(0, 10);

    const apiRequests = ok.filter((r) => r.url.includes("/v1/"));
    const apiDur = apiRequests.map((r) => r.durationMs);

    const scriptRequests = ok.filter((r) => r.resourceType === "script");
    const scriptBytes = scriptRequests.reduce((s, r) => s + r.contentLength, 0);

    const images = ok
      .filter((r) => r.resourceType === "image")
      .map((r) => ({ url: r.url, sizeBytes: r.contentLength, durationMs: r.durationMs }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 10);

    const fonts = ok
      .filter((r) => r.resourceType === "font")
      .map((r) => ({ url: r.url, cacheControl: r.headers["cache-control"] || "" }));

    const staticAssets = ok.filter((r) => r.url.includes("/_next/static/") || r.resourceType === "image" || r.resourceType === "font");
    const cacheStats = { strong: 0, good: 0, weak: 0, missing: 0 };
    for (const a of staticAssets) cacheStats[cacheBucket(a.headers)] += 1;

    const longTasks = perf.vitals.longTasks || [];
    const tbt = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);
    const maxLong = longTasks.reduce((max, t) => Math.max(max, t.duration), 0);

    output.routes.push({
      route: cfg.route,
      url: cfg.url,
      auth: cfg.auth,
      requestCount: ok.length,
      totalPayloadBytes: payloadBytes,
      totalPayloadKb: toKb(payloadBytes),
      duplicateRequests,
      js: {
        totalScriptBytes: scriptBytes,
        totalScriptKb: toKb(scriptBytes),
        scriptRequestCount: scriptRequests.length,
        largestScripts: scriptRequests
          .map((r) => ({ url: r.url, sizeBytes: r.contentLength }))
          .sort((a, b) => b.sizeBytes - a.sizeBytes)
          .slice(0, 10),
      },
      api: {
        requestCount: apiRequests.length,
        endpoints: [...new Set(apiRequests.map((r) => cleanUrl(r.url)))],
        p50Ms: Math.round(quantile(apiDur, 0.5)),
        p95Ms: Math.round(quantile(apiDur, 0.95)),
        maxMs: Math.round(apiDur.length ? Math.max(...apiDur) : 0),
      },
      assets: {
        largestImages: images,
        aboveFoldImageCount: perf.images.filter((img) => img.aboveFold).length,
        aboveFoldImages: perf.images.filter((img) => img.aboveFold).slice(0, 12),
        fonts,
        cacheStats,
      },
      vitalsEstimate: {
        ttfbMs: Math.round(perf.nav.ttfb || 0),
        lcpMs: Math.round(perf.vitals.lcp || 0),
        cls: Number((perf.vitals.cls || 0).toFixed(4)),
        inpProxyMs: Math.round(perf.vitals.maxEventDuration || 0),
        tbtMs: Math.round(tbt),
        maxLongTaskMs: Math.round(maxLong),
      },
      runtime: {
        dclMs: Math.round(perf.nav.dcl || 0),
        loadMs: Math.round(perf.nav.load || 0),
        wallTimeMs: Date.now() - startWall,
      },
    });

    await context.close();
  }

  await browser.close();

  const outDir = new URL("../perf", import.meta.url).pathname;
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "route-localprod-audit.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
