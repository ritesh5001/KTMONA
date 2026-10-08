/**
 * Upstash Redis requires TLS. If a redis:// URL is provided for an Upstash host,
 * transparently upgrade it to rediss:// so ioredis can connect reliably.
 */
export declare function resolveRedisUrl(rawUrl?: string | undefined): string | null;
//# sourceMappingURL=redis-url.d.ts.map