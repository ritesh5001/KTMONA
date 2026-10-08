export type SubdomainType = "admin" | "seller" | "main";

/**
 * Detect the current subdomain from the browser hostname.
 * Returns "admin", "seller", or "main".
 */
export function getSubdomain(): SubdomainType {
  if (typeof window === "undefined") return "main";
  const hostname = window.location.hostname;
  if (hostname.startsWith("admin.")) return "admin";
  if (hostname.startsWith("seller.")) return "seller";
  return "main";
}

/** Roles allowed on each subdomain */
export const SUBDOMAIN_ALLOWED_ROLES: Record<SubdomainType, string[]> = {
  admin: ["ADMIN", "SUPER_ADMIN"],
  seller: ["SELLER"],
  main: ["USER"],
};

/** Map a role to its correct subdomain */
export const ROLE_TO_SUBDOMAIN: Record<string, SubdomainType> = {
  ADMIN: "admin",
  SUPER_ADMIN: "admin",
  SELLER: "seller",
  USER: "main",
};

/**
 * Check whether a role is allowed on the given subdomain.
 */
export function isRoleAllowedOnSubdomain(
  role: string,
  subdomain: SubdomainType
): boolean {
  return SUBDOMAIN_ALLOWED_ROLES[subdomain]?.includes(role.toUpperCase()) ?? false;
}

/**
 * Whether the current host is localhost / 127.0.0.1.
 * Subdomain lock is skipped on localhost since subdomains cannot route.
 */
export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/**
 * Build the correct login URL for a given role based on the current hostname.
 * Handles both production subdomains and local development.
 */
export function getCorrectLoginUrl(role: string): string {
  if (typeof window === "undefined") return "/login";

  const { hostname, protocol, port } = window.location;
  const portSuffix = port ? `:${port}` : "";

  // On localhost, always return same-origin login
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "/login";
  }

  // Derive the base domain (strip existing subdomain prefix)
  let baseDomain = hostname;
  for (const sub of ["admin", "seller", "www"]) {
    if (hostname.startsWith(`${sub}.`)) {
      baseDomain = hostname.slice(sub.length + 1);
      break;
    }
  }

  const targetSub = ROLE_TO_SUBDOMAIN[role.toUpperCase()];

  if (!targetSub || targetSub === "main") {
    return `${protocol}//${baseDomain}${portSuffix}/login`;
  }
  return `${protocol}//${targetSub}.${baseDomain}${portSuffix}/login`;
}

/**
 * Build main storefront URL from any subdomain context.
 * In production this points to https://www.<base-domain>/<home|shop>.
 * On localhost it falls back to in-app routes.
 */
export function getStorefrontUrl(target: "home" | "shop"): string {
  if (typeof window === "undefined") {
    return target === "home" ? "/home" : "/shop";
  }

  const { hostname, protocol, port } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return target === "home" ? "/" : "/marketplace";
  }

  let baseDomain = hostname;
  for (const sub of ["admin", "seller", "www"]) {
    if (hostname.startsWith(`${sub}.`)) {
      baseDomain = hostname.slice(sub.length + 1);
      break;
    }
  }

  const portSuffix = port ? `:${port}` : "";
  const path = target === "home" ? "/home" : "/shop";

  return `${protocol}//www.${baseDomain}${portSuffix}${path}`;
}

/**
 * Build dashboard URL for a role from any current subdomain.
 * Uses cross-subdomain absolute URLs in production, same-origin in localhost.
 */
export function getRoleDashboardUrl(role: string): string {
  if (typeof window === "undefined") return "/user/dashboard";

  const normalizedRole = role.toUpperCase();
  const { hostname, protocol, port } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (normalizedRole === "SELLER") return "/seller/dashboard";
    if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN") {
      return "/admin/dashboard";
    }
    return "/user/dashboard";
  }

  let baseDomain = hostname;
  for (const sub of ["admin", "seller", "www"]) {
    if (hostname.startsWith(`${sub}.`)) {
      baseDomain = hostname.slice(sub.length + 1);
      break;
    }
  }

  const portSuffix = port ? `:${port}` : "";

  if (normalizedRole === "SELLER") {
    return `${protocol}//seller.${baseDomain}${portSuffix}/seller/dashboard`;
  }
  if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN") {
    return `${protocol}//admin.${baseDomain}${portSuffix}/admin/dashboard`;
  }

  return `${protocol}//${baseDomain}${portSuffix}/user/dashboard`;
}
