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
        if (normalized === 'false' || normalized === '0' || normalized === 'off') return 0;
        if (normalized === 'true' || normalized === 'on') return 1;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 1;
    }),
    KEEP_ALIVE_TIMEOUT_MS: z.string().default('65000').transform(Number),
    HEADERS_TIMEOUT_MS: z.string().default('70000').transform(Number),
    REQUEST_TIMEOUT_MS: z.string().default('120000').transform(Number),
    JSON_BODY_LIMIT: z.string().default('5mb'),
    URLENCODED_BODY_LIMIT: z.string().default('5mb'),
    MAX_REQUESTS_PER_SOCKET: z.string().default('1000').transform(Number),
    // KTMONA Ads (sponsored listings, seller campaigns, admin oversight).
    // Off unless set to "true"; while off, every ads endpoint answers 404.
    FEATURE_ADS: z.string().optional().transform((v) => (v ?? '').trim().toLowerCase() === 'true'),
    RUN_BACKGROUND_JOBS: z.string().optional().transform((v) => {
        if (!v) return undefined;
        const normalized = v.trim().toLowerCase();
        return !(normalized === 'false' || normalized === '0' || normalized === 'off');
    }),
    BACKEND_WARMUP_URL: z.string().url('BACKEND_WARMUP_URL must be a valid URL').optional(),
    // 14 minutes: Render's free tier spins a service down after 15 minutes
    // without inbound traffic, so this is the longest ping that still keeps it
    // up. It used to be 4 minutes, which kept Render awake 3x more often than
    // necessary and — when BACKEND_WARMUP_URL points at a DB-backed route —
    // kept Neon's compute awake with it.
    BACKEND_WARMUP_INTERVAL_MS: z.string().default('840000').transform(Number),
    // How often the consolidated maintenance sweep runs. See MAINTENANCE_INTERVAL_MS
    // in server.ts for why this is deliberately long.
    MAINTENANCE_INTERVAL_MS: z.string().default('1800000').transform(Number),
    // How long after the last real request the storefront cache keeps being
    // warmed. Warming exists so a shopper never pays for a cold read; with no
    // shoppers there is nothing to protect, and the queries only serve to keep
    // the database from ever suspending.
    CATALOG_WARMUP_IDLE_AFTER_MS: z.string().default('1800000').transform(Number),
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
    /**
     * Buyer and seller sessions stay signed in until a manual logout: their
     * refresh token gets this lifetime, renewed on every refresh (sliding).
     * Admin/staff sessions keep the shorter REFRESH_TOKEN_EXPIRY.
     */
    PERSISTENT_REFRESH_TOKEN_EXPIRY: z.string().default('365d'),

    // Public portal URLs (used in email CTA links)
    FRONTEND_BASE_URL: z.string().url('FRONTEND_BASE_URL must be a valid URL').optional(),
    SELLER_BASE_URL: z.string().url('SELLER_BASE_URL must be a valid URL').optional(),
    FRONTEND_REVALIDATE_URL: z.string().url('FRONTEND_REVALIDATE_URL must be a valid URL').optional(),
    FRONTEND_REVALIDATE_SECRET: z.string().min(1, 'FRONTEND_REVALIDATE_SECRET cannot be empty').optional(),
    LIVE_EVENTS_CHANNEL: z.string().default('ktmona:live-events'),

    // Redis
    REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional(),
    // Legacy Upstash vars retained as optional for backwards compatibility
    UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL').optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required').optional(),

    // Resend
    RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
    EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email'),

    /**
     * Where OTP codes go. 'email' (default): always the account's email; SMS is
     * used only for old accounts that have no email. 'sms': mobile number first,
     * email as fallback. Switch to 'sms' once mobile OTP should be turned on.
     */
    OTP_CHANNEL: z.enum(['email', 'sms']).default('email'),

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
        .default('{otp} is your OTP for KTMONA. Valid for 10 minutes. Do not share it with anyone.'),
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

    // Razorpay (Standard Checkout). Key id + secret from Dashboard → Account &
    // Settings → API Keys; the webhook secret is the one typed into the webhook
    // set up for https://api.ktmona.com/v1/payments/webhook/razorpay.
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    // Shiprocket shipping API (AWB, labels, pickups, manifests) for seller
    // orders. Use a dedicated Shiprocket "API user" (Settings → API). Unset =
    // sellers self-ship and enter the courier + AWB themselves.
    SHIPROCKET_EMAIL: z.string().optional(),
    SHIPROCKET_PASSWORD: z.string().optional(),
    // ShipMaxx shipping API (appapi.losung360.com/external/v1). Takes over
    // from Shiprocket for new bookings when its email, password and channel
    // id are all set. The channel id is the "Custom" channel created under
    // the ShipMaxx account (Channels page); every API order is filed under it.
    SHIPMAXX_EMAIL: z.string().optional(),
    SHIPMAXX_PASSWORD: z.string().optional(),
    SHIPMAXX_CHANNEL_ID: z.coerce.number().int().positive().optional(),
    SHIPMAXX_BASE_URL: z.string().url().default('https://appapi.losung360.com/external/v1'),
});

/**
 * Parsed and validated environment variables type
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Throws detailed error if validation fails
 */
function parseEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formattedErrors = result.error.errors
            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');

        throw new Error(
            `❌ Environment validation failed:\n${formattedErrors}\n\nPlease check your .env file.`
        );
    }

    return result.data;
}

/**
 * Validated environment configuration
 * Singleton pattern - parsed once on import
 */
export const env: Env = parseEnv();
