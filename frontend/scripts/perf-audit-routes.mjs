import fs from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "playwright";

const API_BASE = "https://api.ktmona.com";
const WEB_BASE = "https://www.ktmona.com";
const SELLER_BASE = "https://seller.ktmona.com";
const ADMIN_BASE = "https://admin.ktmona.com";

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
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
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
  if (!response.ok) {
    throw new Error(`Login failed for ${role}: ${response.status}`);
  }
  return response.json();
}

function authCookies(session) {
  const { accessToken, refreshToken, user } = session;
  const domain = ".ktmona.com";
  return [
    {
      name: "ktmona_access",
      value: accessToken,
      domain,
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "ktmona_refresh",
      value: refreshToken,
      domain,
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "ktmona_role",
      value: user.role,
      domain,
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "ktmona_user",
      value: encodeURIComponent(JSON.stringify(user)),
      domain,
      path: "/",
      httpOnly: false,
      secure: true,
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

function getBlockingRequests(records, domInteractiveMs) {
  return records.filter((r) => {
    return (
      r.startMs <= domInteractiveMs &&
      (r.resourceType === "script" || r.resourceType === "stylesheet" || r.resourceType === "font")
    );
  }).length;
}

function classifyCache(headers = {}) {
  const cc = String(headers["cache-control"] || "").toLowerCase();
  if (!cc) return "missing";
  if (cc.includes("immutable")) return "strong";
  if (cc.includes("max-age=31536000")) return "strong";
  if (cc.includes("max-age=86400") || cc.includes("stale-while-revalidate")) return "good";
  return "weak";
}

async function run() {
  const [adminSession, sellerSession, userSession] = await Promise.all([
    login("admin"),
    login("seller"),
    login("user"),
  ]);

  const productId = (await getProductId()) || "cmnjz6kut0013xnsyvnklgo0b";

  const routes = [
    { route: "/", url: `${WEB_BASE}/`, auth: "none" },
    { route: "/marketplace", url: `${WEB_BASE}/marketplace`, auth: "none" },
    { route: "/search", url: `${WEB_BASE}/search?q=kurta`, auth: "none" },
    { route: "/product/[id]", url: `${WEB_BASE}/product/${productId}`, auth: "none" },
    { route: "/cart", url: `${WEB_BASE}/cart`, auth: "user" },
    { route: "/checkout", url: `${WEB_BASE}/checkout`, auth: "user" },
    { route: "/seller/dashboard", url: `${SELLER_BASE}/dashboard`, auth: "seller" },
    { route: "/admin/dashboard", url: `${ADMIN_BASE}/dashboard`, auth: "admin" },
  ];

  const browser = await chromium.launch({ headless: true });
  const output = {
    generatedAt: new Date().toISOString(),
    productId,
    routes: [],
  };

  for (const cfg of routes) {
    const context = await browser.newContext({
      ...devices["Pixel 5"],
      ignoreHTTPSErrors: true,
    });

    if (cfg.auth === "user") await context.addCookies(authCookies(userSession));
    if (cfg.auth === "seller") await context.addCookies(authCookies(sellerSession));
    if (cfg.auth === "admin") await context.addCookies(authCookies(adminSession));

    const page = await context.newPage();

    await page.addInitScript(() => {
      window.__perfAudit = {
        lcp: 0,
        cls: 0,
        maxEventDuration: 0,
        longTasks: [],
      };

      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const last = entries[entries.length - 1];
          if (last) window.__perfAudit.lcp = last.startTime;
        });
        lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}

      try {
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__perfAudit.cls += entry.value;
            }
          }
        });
        clsObserver.observe({ type: "layout-shift", buffered: true });
      } catch {}

      try {
        const eventObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.duration > window.__perfAudit.maxEventDuration) {
              window.__perfAudit.maxEventDuration = entry.duration;
            }
          }
        });
        eventObserver.observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {}

      try {
        const longTaskObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            window.__perfAudit.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        });
        longTaskObserver.observe({ type: "longtask", buffered: true });
      } catch {}
    });

    const starts = new Map();
    const records = [];

    page.on("request", (request) => {
      starts.set(request, Date.now());
    });

    page.on("response", async (response) => {
      const request = response.request();
      const started = starts.get(request) || Date.now();
      const durationMs = Date.now() - started;
      const headers = await response.allHeaders();
      let contentLength = Number(headers["content-length"] || 0) || 0;
      if (!contentLength) {
        try {
          const body = await response.body();
          contentLength = body.length;
        } catch {
          contentLength = 0;
        }
      }

      records.push({
        url: response.url(),
        normalizedUrl: cleanUrl(response.url()),
        status: response.status(),
        method: request.method(),
        resourceType: request.resourceType(),
        durationMs,
        startMs: started,
        contentLength,
        headers,
      });
    });

    const tNav = Date.now();
    await page.goto(cfg.url, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(2500);

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const dcl = nav ? nav.domContentLoadedEventEnd : 0;
      const load = nav ? nav.loadEventEnd : 0;
      const ttfb = nav ? nav.responseStart : 0;

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
          dcl,
          load,
          ttfb,
        },
        vitals: window.__perfAudit,
        images: imgs,
      };
    });

    const firstLoadRequests = records.filter((r) => r.status > 0);
    const requestCount = firstLoadRequests.length;
    const totalPayloadBytes = firstLoadRequests.reduce((sum, r) => sum + r.contentLength, 0);

    const dupMap = new Map();
    for (const r of firstLoadRequests) {
      dupMap.set(r.normalizedUrl, (dupMap.get(r.normalizedUrl) || 0) + 1);
    }
    const duplicateRequests = [...dupMap.entries()]
      .filter(([, count]) => count > 1)
      .map(([url, count]) => ({ url, count }))
      .slice(0, 10);

    const apiRequests = firstLoadRequests.filter((r) => r.url.includes("/v1/"));
    const apiDurations = apiRequests.map((r) => r.durationMs);

    const imageRequests = firstLoadRequests
      .filter((r) => r.resourceType === "image")
      .map((r) => ({ url: r.url, sizeBytes: r.contentLength, durationMs: r.durationMs }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 8);

    const scriptRequests = firstLoadRequests
      .filter((r) => r.resourceType === "script")
      .map((r) => ({ url: r.url, sizeBytes: r.contentLength, durationMs: r.durationMs }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes);

    const fontRequests = firstLoadRequests
      .filter((r) => r.resourceType === "font")
      .map((r) => ({ url: r.url, cacheControl: r.headers["cache-control"] || "" }));

    const staticAssets = firstLoadRequests.filter(
      (r) => r.url.includes("/_next/static/") || r.resourceType === "image" || r.resourceType === "font"
    );

    const cacheStats = {
      strong: 0,
      good: 0,
      weak: 0,
      missing: 0,
    };
    for (const a of staticAssets) {
      cacheStats[classifyCache(a.headers)] += 1;
    }

    const longTasks = perf.vitals.longTasks || [];
    const totalBlockingTimeMs = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);
    const maxLongTaskMs = longTasks.reduce((max, t) => Math.max(max, t.duration), 0);

    const aboveFoldImages = perf.images.filter((img) => img.aboveFold);

    output.routes.push({
      route: cfg.route,
      url: cfg.url,
      auth: cfg.auth,
      measuredAt: new Date().toISOString(),
      requestCount,
      blockingRequestCount: getBlockingRequests(firstLoadRequests, perf.nav.dcl),
      duplicateRequests,
      totalPayloadBytes,
      totalPayloadKb: toKb(totalPayloadBytes),
      js: {
        scriptRequestCount: scriptRequests.length,
        totalScriptBytes: scriptRequests.reduce((sum, item) => sum + item.sizeBytes, 0),
        totalScriptKb: toKb(scriptRequests.reduce((sum, item) => sum + item.sizeBytes, 0)),
        largestScripts: scriptRequests.slice(0, 10),
      },
      api: {
        requestCount: apiRequests.length,
        endpoints: [...new Set(apiRequests.map((r) => cleanUrl(r.url)))],
        p50Ms: Math.round(quantile(apiDurations, 0.5)),
        p95Ms: Math.round(quantile(apiDurations, 0.95)),
        maxMs: Math.round(apiDurations.length ? Math.max(...apiDurations) : 0),
      },
      assets: {
        largestImages: imageRequests,
        aboveFoldImageCount: aboveFoldImages.length,
        aboveFoldImages: aboveFoldImages.slice(0, 12),
        fonts: fontRequests,
        cacheStats,
      },
      vitalsEstimate: {
        ttfbMs: Math.round(perf.nav.ttfb || 0),
        lcpMs: Math.round(perf.vitals.lcp || 0),
        cls: Number((perf.vitals.cls || 0).toFixed(4)),
        inpProxyMs: Math.round(perf.vitals.maxEventDuration || 0),
        tbtMs: Math.round(totalBlockingTimeMs),
        maxLongTaskMs: Math.round(maxLongTaskMs),
      },
      runtime: {
        dclMs: Math.round(perf.nav.dcl || 0),
        loadMs: Math.round(perf.nav.load || 0),
        navWallTimeMs: Date.now() - tNav,
      },
    });

    await context.close();
  }

  await browser.close();

  const outDir = new URL("../perf", import.meta.url).pathname;
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "route-runtime-audit.json"), JSON.stringify(output, null, 2));
  console.log(`Wrote ${path.join(outDir, "route-runtime-audit.json")}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
