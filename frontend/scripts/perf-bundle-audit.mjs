import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const ROOT = new URL("..", import.meta.url).pathname;
const NEXT_DIR = path.join(ROOT, ".next");

const ROUTES = [
  {
    route: "/",
    sourcePage: path.join(ROOT, "src/app/(storefront)/page.tsx"),
    manifest: path.join(NEXT_DIR, "server/app/(storefront)/page_client-reference-manifest.js"),
  },
  {
    route: "/marketplace",
    sourcePage: path.join(ROOT, "src/app/(storefront)/marketplace/page.tsx"),
    manifest: path.join(NEXT_DIR, "server/app/(storefront)/marketplace/page_client-reference-manifest.js"),
  },
  {
    route: "/search",
    sourcePage: path.join(ROOT, "src/app/(storefront)/search/page.tsx"),
    manifest: path.join(NEXT_DIR, "server/app/(storefront)/search/page_client-reference-manifest.js"),
  },
  {
    route: "/product/[id]",
    sourcePage: path.join(ROOT, "src/app/(storefront)/product/[id]/page.tsx"),
    manifest: path.join(NEXT_DIR, "server/app/(storefront)/product/[id]/page_client-reference-manifest.js"),
  },
  {
    route: "/cart",
    sourcePage: path.join(ROOT, "src/app/(storefront)/cart/page.tsx"),
    manifest: path.join(NEXT_DIR, "server/app/(storefront)/cart/page_client-reference-manifest.js"),
  },
  {
    route: "/checkout",
    sourcePage: path.join(ROOT, "src/app/(storefront)/checkout/page.tsx"),
    manifest: path.join(NEXT_DIR, "server/app/(storefront)/checkout/page_client-reference-manifest.js"),
  },
  {
    route: "/seller/dashboard",
    sourcePage: path.join(ROOT, "src/app/(seller)/seller/dashboard/page.tsx"),
    manifest: path.join(NEXT_DIR, "server/app/(seller)/seller/dashboard/page_client-reference-manifest.js"),
  },
  {
    route: "/admin/dashboard",
    sourcePage: path.join(ROOT, "src/app/(admin)/admin/dashboard/page.tsx"),
    manifest: path.join(NEXT_DIR, "server/app/(admin)/admin/dashboard/page_client-reference-manifest.js"),
  },
];

function toKb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

function getPackageName(modulePath) {
  const marker = "/node_modules/";
  const idx = modulePath.indexOf(marker);
  if (idx < 0) return null;
  const rem = modulePath.slice(idx + marker.length);
  const parts = rem.split("/");
  if (!parts[0]) return null;
  if (parts[0].startsWith("@") && parts[1]) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(abs)));
    } else {
      out.push(abs);
    }
  }
  return out;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function parseClientReferenceManifest(file) {
  const code = await fs.readFile(file, "utf8");
  const sandbox = { globalThis: { __RSC_MANIFEST: {} } };
  vm.runInNewContext(code, sandbox);
  const key = Object.keys(sandbox.globalThis.__RSC_MANIFEST)[0];
  return sandbox.globalThis.__RSC_MANIFEST[key];
}

async function main() {
  const buildManifest = await readJson(path.join(NEXT_DIR, "build-manifest.json"));
  const chunkFiles = await walk(path.join(NEXT_DIR, "static/chunks"));

  const sizeMap = new Map();
  for (const abs of chunkFiles) {
    if (!abs.endsWith(".js")) continue;
    const rel = path.relative(NEXT_DIR, abs).replaceAll("\\", "/");
    const st = await fs.stat(abs);
    sizeMap.set(rel, st.size);
  }

  const initialChunks = [
    ...(buildManifest.polyfillFiles || []),
    ...(buildManifest.rootMainFiles || []),
  ].filter((p) => p.endsWith(".js"));

  const initialBytes = [...new Set(initialChunks)].reduce((sum, chunk) => sum + (sizeMap.get(chunk) || 0), 0);

  const routeResults = [];

  for (const cfg of ROUTES) {
    const manifest = await parseClientReferenceManifest(cfg.manifest);
    const clientModules = manifest.clientModules || {};

    const routeChunks = new Set();
    for (const meta of Object.values(clientModules)) {
      const chunks = meta?.chunks || [];
      for (const c of chunks) {
        if (typeof c === "string" && c.startsWith("static/chunks/") && c.endsWith(".js")) {
          routeChunks.add(c);
        }
      }
    }

    const routeSpecificChunks = [...routeChunks].filter((c) => !initialChunks.includes(c));
    const routeSpecificBytes = routeSpecificChunks.reduce((sum, c) => sum + (sizeMap.get(c) || 0), 0);

    const totalShippedBytes = initialBytes + routeSpecificBytes;

    const largestChunks = [...new Set([...initialChunks, ...routeSpecificChunks])]
      .map((c) => ({ chunk: c, bytes: sizeMap.get(c) || 0 }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);

    const pkgChunks = new Map();
    let projectClientModulesCount = 0;
    let thirdPartyClientModulesCount = 0;

    for (const [modulePath, meta] of Object.entries(clientModules)) {
      const chunks = (meta?.chunks || []).filter(
        (c) => typeof c === "string" && c.startsWith("static/chunks/") && c.endsWith(".js")
      );

      if (modulePath.includes("/src/")) {
        projectClientModulesCount += 1;
      }

      const pkg = getPackageName(modulePath);
      if (!pkg) continue;
      thirdPartyClientModulesCount += 1;
      if (!pkgChunks.has(pkg)) pkgChunks.set(pkg, new Set());
      for (const c of chunks) pkgChunks.get(pkg).add(c);
    }

    const topLibraries = [...pkgChunks.entries()]
      .map(([pkg, chunks]) => {
        let bytes = 0;
        for (const c of chunks) bytes += sizeMap.get(c) || 0;
        return { library: pkg, bytes };
      })
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8);

    const sourceText = await fs.readFile(cfg.sourcePage, "utf8");
    const pageIsClient = sourceText.trimStart().startsWith('"use client"') || sourceText.trimStart().startsWith("'use client'");

    routeResults.push({
      route: cfg.route,
      js: {
        initialBytes,
        initialKb: toKb(initialBytes),
        routeSpecificBytes,
        routeSpecificKb: toKb(routeSpecificBytes),
        totalShippedBytes,
        totalShippedKb: toKb(totalShippedBytes),
        largestChunks: largestChunks.map((c) => ({ ...c, kb: toKb(c.bytes) })),
      },
      libraries: topLibraries.map((l) => ({ ...l, kb: toKb(l.bytes) })),
      clientServer: {
        pageIsClient,
        projectClientModulesCount,
        thirdPartyClientModulesCount,
      },
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: "frontend/.next manifests",
    routes: routeResults,
  };

  const outDir = path.join(ROOT, "perf");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "route-bundle-audit.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
