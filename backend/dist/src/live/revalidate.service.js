import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { dedupeTags } from './cache-tags.js';
// Defaults so on-demand cache revalidation works out-of-the-box with no env setup.
// DEFAULT_REVALIDATE_SECRET must stay identical to the frontend default in
// frontend/src/app/api/internal/revalidate/route.ts. Override both via env for stronger security.
const DEFAULT_FRONTEND_BASE_URL = 'https://www.tatvivahtrends.com';
const DEFAULT_REVALIDATE_SECRET = '48aba57348db9e7a3c077b11a97f511deaa9b6486e6b5a1950c1ffc2bb639557';
function resolveRevalidateUrl() {
    if (env.FRONTEND_REVALIDATE_URL) {
        return env.FRONTEND_REVALIDATE_URL;
    }
    const base = env.FRONTEND_BASE_URL ?? DEFAULT_FRONTEND_BASE_URL;
    return `${base.replace(/\/$/, '')}/api/internal/revalidate`;
}
export async function triggerFrontendRevalidation(tags) {
    const sanitizedTags = dedupeTags(tags);
    if (sanitizedTags.length === 0)
        return;
    const url = resolveRevalidateUrl();
    const secret = env.FRONTEND_REVALIDATE_SECRET ?? DEFAULT_REVALIDATE_SECRET;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-revalidate-secret': secret,
            },
            body: JSON.stringify({ tags: sanitizedTags }),
        });
        if (!response.ok) {
            logger.warn({ status: response.status, url, tags: sanitizedTags }, 'frontend_revalidate_request_failed');
        }
    }
    catch (error) {
        logger.warn({ error, url, tags: sanitizedTags }, 'frontend_revalidate_request_error');
    }
}
//# sourceMappingURL=revalidate.service.js.map