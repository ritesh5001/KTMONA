import { env } from './env.js';
import { logger } from './logger.js';

let upstashTlsUpgradeLogged = false;

/**
 * Upstash Redis requires TLS. If a redis:// URL is provided for an Upstash host,
 * transparently upgrade it to rediss:// so ioredis can connect reliably.
 */
export function resolveRedisUrl(rawUrl: string | undefined = env.REDIS_URL): string | null {
    if (!rawUrl) return null;

    try {
        const parsed = new URL(rawUrl);
        const isUpstashHost = parsed.hostname.endsWith('.upstash.io');

        if (isUpstashHost && parsed.protocol === 'redis:') {
            parsed.protocol = 'rediss:';

            if (!upstashTlsUpgradeLogged) {
                upstashTlsUpgradeLogged = true;
                logger.info(
                    { host: parsed.hostname },
                    'redis_url_upgraded_to_tls_for_upstash',
                );
            }
        }

        return parsed.toString();
    } catch {
        return rawUrl;
    }
}