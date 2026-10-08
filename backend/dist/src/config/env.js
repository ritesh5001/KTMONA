import { z } from 'zod';
import dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();
/**
 * Environment variable schema with validation
 */
const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3000'),
    TRUST_PROXY: z.string().default('1').transform((v) => {
        const normalized = v.trim().toLowerCase();
        if (normalized === 'false' || normalized === '0' || normalized === 'off')
            return 0;
        if (normalized === 'true' || normalized === 'on')
            return 1;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 1;
    }),
    KEEP_ALIVE_TIMEOUT_MS: z.string().default('65000').transform(Number),
    HEADERS_TIMEOUT_MS: z.string().default('70000').transform(Number),
    REQUEST_TIMEOUT_MS: z.string().default('120000').transform(Number),
    JSON_BODY_LIMIT: z.string().default('5mb'),
    URLENCODED_BODY_LIMIT: z.string().default('5mb'),
    MAX_REQUESTS_PER_SOCKET: z.string().default('1000').transform(Number),
    RUN_BACKGROUND_JOBS: z.string().optional().transform((v) => {
        if (!v)
            return undefined;
        const normalized = v.trim().toLowerCase();
        return !(normalized === 'false' || normalized === '0' || normalized === 'off');
    }),
    BACKEND_WARMUP_URL: z.string().url('BACKEND_WARMUP_URL must be a valid URL').optional(),
    BACKEND_WARMUP_INTERVAL_MS: z.string().default('240000').transform(Number),
    PRISMA_LOG_QUERIES: z.string().default('false').transform((v) => {
        const normalized = v.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'on';
    }),
    // Database
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    DATABASE_URL_DIRECT: z.string().url('DATABASE_URL_DIRECT must be a valid URL').optional(),
    // JWT Secrets
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    // Token Expiry
    ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
    // Public portal URLs (used in email CTA links)
    FRONTEND_BASE_URL: z.string().url('FRONTEND_BASE_URL must be a valid URL').optional(),
    SELLER_BASE_URL: z.string().url('SELLER_BASE_URL must be a valid URL').optional(),
    FRONTEND_REVALIDATE_URL: z.string().url('FRONTEND_REVALIDATE_URL must be a valid URL').optional(),
    FRONTEND_REVALIDATE_SECRET: z.string().min(1, 'FRONTEND_REVALIDATE_SECRET cannot be empty').optional(),
    LIVE_EVENTS_CHANNEL: z.string().default('tatvivah:live-events'),
    // Redis
    REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional(),
    // Legacy Upstash vars retained as optional for backwards compatibility
    UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL').optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required').optional(),
    // Resend
    RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
    EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email'),
    // AquaSMS (SMS OTP delivery)
    AQUASMS_USERNAME: z.string().optional(),
    AQUASMS_API_KEY: z.string().optional(),
    /** DLT-registered sender id / header, e.g. TATVIV. Required to send. */
    AQUASMS_SENDER_ID: z.string().optional(),
    /**
     * HTTPS by default. The provider documents http:// URLs, but an OTP, the
     * recipient's number and the API key all travel in the query string — those
     * must not cross the network in the clear.
     */
    AQUASMS_BASE_URL: z
        .string()
        .url('AQUASMS_BASE_URL must be a valid URL')
        .default('https://login.aquasms.com')
        .transform((url) => url.replace(/\/+$/, '')),
    /** TRANS for transactional (OTP) traffic; PROMO is promotional and DND-filtered. */
    AQUASMS_SMS_TYPE: z.string().default('TRANS'),
    /** DLT principal entity id — required by Indian operators for transactional SMS. */
    AQUASMS_DLT_PE_ID: z.string().optional(),
    /** DLT-approved template id matching AQUASMS_OTP_TEMPLATE exactly. */
    AQUASMS_DLT_TEMPLATE_ID: z.string().optional(),
    /**
     * OTP message body. {otp} is substituted; every other character must match the
     * DLT-approved template exactly or operators reject the message.
     */
    AQUASMS_OTP_TEMPLATE: z
        .string()
        .default('{otp} is your OTP for TatVivah. Valid for 10 minutes. Do not share it with anyone.'),
    AQUASMS_TIMEOUT_MS: z.string().default('20000').transform(Number),
    /**
     * Escape hatch: treat SMS as usable even without DLT ids. Off by default because
     * Indian operators drop non-DLT commercial SMS while the provider still reports
     * success and bills for it. Only enable once real delivery has been confirmed.
     */
    AQUASMS_ALLOW_NON_DLT: z
        .string()
        .default('false')
        .transform((v) => v.toLowerCase() === 'true'),
    // ImageKit
    IMAGEKIT_PUBLIC_KEY: z.string().optional(),
    IMAGEKIT_PRIVATE_KEY: z.string().optional(),
    IMAGEKIT_URL_ENDPOINT: z.string().optional(),
    // FASHN virtual try-on
    FASHN_API_KEY: z.string().optional(),
    FASHN_TRYON_MODEL: z.enum(['tryon-max', 'tryon-v1.6']).default('tryon-max'),
    FASHN_POLL_INTERVAL_MS: z.string().default('3000').transform(Number),
    FASHN_POLL_TIMEOUT_MS: z.string().default('115000').transform(Number),
    // Public base URL of THIS backend (used for absolute links / webhooks).
    BACKEND_PUBLIC_URL: z.string().url('BACKEND_PUBLIC_URL must be a valid URL').optional(),
    // PhonePe PG (Standard Checkout v2)
    // The SDK's init() needs the merchant id, which is distinct from the OAuth
    // client id on some PhonePe accounts. Falls back to CLIENT_ID when unset,
    // which is correct for accounts where they are the same value.
    PHONEPE_MERCHANT_ID: z.string().optional(),
    PHONEPE_CLIENT_ID: z.string().optional(),
    PHONEPE_CLIENT_SECRET: z.string().optional(),
    PHONEPE_CLIENT_VERSION: z.string().default('1'),
    PHONEPE_ENV: z.enum(['SANDBOX', 'PRODUCTION']).default('SANDBOX'),
    // Basic-auth credentials mirrored on the PhonePe dashboard webhook config.
    PHONEPE_WEBHOOK_USERNAME: z.string().optional(),
    PHONEPE_WEBHOOK_PASSWORD: z.string().optional(),
    // Shared secret for the Shiprocket catalog feed. Optional on purpose: their
    // documented requests send no auth header, so the endpoints launch open and
    // close the moment this is set on both sides.
    SHIPROCKET_API_KEY: z.string().optional(),
    // -------------------------------------------------------------------
    // Shiprocket Checkout (Fastrr)
    //
    // Fastrr hosts the entire address + payment step. We only mint an access
    // token, then learn the outcome from their webhook. The key/secret pair is
    // issued by Shiprocket per merchant account; without both, the integration
    // stays dormant and the native PhonePe checkout continues to serve buyers.
    // -------------------------------------------------------------------
    FASTRR_API_KEY: z.string().optional(),
    FASTRR_API_SECRET: z.string().optional(),
    /**
     * SANDBOX targets Shiprocket's dev stack, PRODUCTION the live one. This picks
     * both the API host and the checkout UI bundle, so the two can never be
     * mismatched — a prod token handed to the staging bundle simply fails.
     */
    FASTRR_ENV: z.enum(['SANDBOX', 'PRODUCTION']).default('SANDBOX'),
    /** Escape hatch for a host Shiprocket moves without warning. */
    FASTRR_BASE_URL: z.string().url('FASTRR_BASE_URL must be a valid URL').optional(),
    /**
     * Master switch for the buyer-facing flow. Off by default: the credentials
     * alone should not silently reroute live checkout traffic. Turn this off to
     * fall straight back to the native PhonePe checkout with no deploy.
     */
    FASTRR_CHECKOUT_ENABLED: z
        .string()
        .default('false')
        .transform((v) => v.trim().toLowerCase() === 'true'),
    FASTRR_TIMEOUT_MS: z.string().default('20000').transform(Number),
    /**
     * Optional shared secret for the inbound order webhook. Shiprocket does not
     * document signing that callback, so we never trust its body regardless —
     * every payload is re-verified against their Order/Details API. When set,
     * this additionally gates the endpoint on a matching X-Api-Key.
     */
    FASTRR_WEBHOOK_API_KEY: z.string().optional(),
    // Optional deep link the mobile app is redirected to after payment.
    PHONEPE_MOBILE_REDIRECT_URL: z.string().optional(),
    // Optional override for the web redirect base (defaults to FRONTEND_BASE_URL).
    PHONEPE_WEB_REDIRECT_BASE_URL: z.string().optional(),
});
/**
 * Parse and validate environment variables
 * Throws detailed error if validation fails
 */
function parseEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        const formattedErrors = result.error.errors
            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');
        throw new Error(`❌ Environment validation failed:\n${formattedErrors}\n\nPlease check your .env file.`);
    }
    return result.data;
}
/**
 * Validated environment configuration
 * Singleton pattern - parsed once on import
 */
export const env = parseEnv();
//# sourceMappingURL=env.js.map