import { z } from 'zod';
/**
 * Environment variable schema with validation
 */
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    PORT: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    TRUST_PROXY: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    KEEP_ALIVE_TIMEOUT_MS: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    HEADERS_TIMEOUT_MS: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    REQUEST_TIMEOUT_MS: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    JSON_BODY_LIMIT: z.ZodDefault<z.ZodString>;
    URLENCODED_BODY_LIMIT: z.ZodDefault<z.ZodString>;
    MAX_REQUESTS_PER_SOCKET: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    RUN_BACKGROUND_JOBS: z.ZodEffects<z.ZodOptional<z.ZodString>, boolean | undefined, string | undefined>;
    BACKEND_WARMUP_URL: z.ZodOptional<z.ZodString>;
    BACKEND_WARMUP_INTERVAL_MS: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    PRISMA_LOG_QUERIES: z.ZodEffects<z.ZodDefault<z.ZodString>, boolean, string | undefined>;
    DATABASE_URL: z.ZodString;
    DATABASE_URL_DIRECT: z.ZodOptional<z.ZodString>;
    JWT_ACCESS_SECRET: z.ZodString;
    JWT_REFRESH_SECRET: z.ZodString;
    ACCESS_TOKEN_EXPIRY: z.ZodDefault<z.ZodString>;
    REFRESH_TOKEN_EXPIRY: z.ZodDefault<z.ZodString>;
    FRONTEND_BASE_URL: z.ZodOptional<z.ZodString>;
    SELLER_BASE_URL: z.ZodOptional<z.ZodString>;
    FRONTEND_REVALIDATE_URL: z.ZodOptional<z.ZodString>;
    FRONTEND_REVALIDATE_SECRET: z.ZodOptional<z.ZodString>;
    LIVE_EVENTS_CHANNEL: z.ZodDefault<z.ZodString>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    UPSTASH_REDIS_REST_URL: z.ZodOptional<z.ZodString>;
    UPSTASH_REDIS_REST_TOKEN: z.ZodOptional<z.ZodString>;
    RESEND_API_KEY: z.ZodString;
    EMAIL_FROM: z.ZodString;
    AQUASMS_USERNAME: z.ZodOptional<z.ZodString>;
    AQUASMS_API_KEY: z.ZodOptional<z.ZodString>;
    /** DLT-registered sender id / header, e.g. TATVIV. Required to send. */
    AQUASMS_SENDER_ID: z.ZodOptional<z.ZodString>;
    /**
     * HTTPS by default. The provider documents http:// URLs, but an OTP, the
     * recipient's number and the API key all travel in the query string — those
     * must not cross the network in the clear.
     */
    AQUASMS_BASE_URL: z.ZodEffects<z.ZodDefault<z.ZodString>, string, string | undefined>;
    /** TRANS for transactional (OTP) traffic; PROMO is promotional and DND-filtered. */
    AQUASMS_SMS_TYPE: z.ZodDefault<z.ZodString>;
    /** DLT principal entity id — required by Indian operators for transactional SMS. */
    AQUASMS_DLT_PE_ID: z.ZodOptional<z.ZodString>;
    /** DLT-approved template id matching AQUASMS_OTP_TEMPLATE exactly. */
    AQUASMS_DLT_TEMPLATE_ID: z.ZodOptional<z.ZodString>;
    /**
     * OTP message body. {otp} is substituted; every other character must match the
     * DLT-approved template exactly or operators reject the message.
     */
    AQUASMS_OTP_TEMPLATE: z.ZodDefault<z.ZodString>;
    AQUASMS_TIMEOUT_MS: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    /**
     * Escape hatch: treat SMS as usable even without DLT ids. Off by default because
     * Indian operators drop non-DLT commercial SMS while the provider still reports
     * success and bills for it. Only enable once real delivery has been confirmed.
     */
    AQUASMS_ALLOW_NON_DLT: z.ZodEffects<z.ZodDefault<z.ZodString>, boolean, string | undefined>;
    IMAGEKIT_PUBLIC_KEY: z.ZodOptional<z.ZodString>;
    IMAGEKIT_PRIVATE_KEY: z.ZodOptional<z.ZodString>;
    IMAGEKIT_URL_ENDPOINT: z.ZodOptional<z.ZodString>;
    FASHN_API_KEY: z.ZodOptional<z.ZodString>;
    FASHN_TRYON_MODEL: z.ZodDefault<z.ZodEnum<["tryon-max", "tryon-v1.6"]>>;
    FASHN_POLL_INTERVAL_MS: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    FASHN_POLL_TIMEOUT_MS: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    BACKEND_PUBLIC_URL: z.ZodOptional<z.ZodString>;
    PHONEPE_MERCHANT_ID: z.ZodOptional<z.ZodString>;
    PHONEPE_CLIENT_ID: z.ZodOptional<z.ZodString>;
    PHONEPE_CLIENT_SECRET: z.ZodOptional<z.ZodString>;
    PHONEPE_CLIENT_VERSION: z.ZodDefault<z.ZodString>;
    PHONEPE_ENV: z.ZodDefault<z.ZodEnum<["SANDBOX", "PRODUCTION"]>>;
    PHONEPE_WEBHOOK_USERNAME: z.ZodOptional<z.ZodString>;
    PHONEPE_WEBHOOK_PASSWORD: z.ZodOptional<z.ZodString>;
    SHIPROCKET_API_KEY: z.ZodOptional<z.ZodString>;
    FASTRR_API_KEY: z.ZodOptional<z.ZodString>;
    FASTRR_API_SECRET: z.ZodOptional<z.ZodString>;
    /**
     * SANDBOX targets Shiprocket's dev stack, PRODUCTION the live one. This picks
     * both the API host and the checkout UI bundle, so the two can never be
     * mismatched — a prod token handed to the staging bundle simply fails.
     */
    FASTRR_ENV: z.ZodDefault<z.ZodEnum<["SANDBOX", "PRODUCTION"]>>;
    /** Escape hatch for a host Shiprocket moves without warning. */
    FASTRR_BASE_URL: z.ZodOptional<z.ZodString>;
    /**
     * Master switch for the buyer-facing flow. Off by default: the credentials
     * alone should not silently reroute live checkout traffic. Turn this off to
     * fall straight back to the native PhonePe checkout with no deploy.
     */
    FASTRR_CHECKOUT_ENABLED: z.ZodEffects<z.ZodDefault<z.ZodString>, boolean, string | undefined>;
    FASTRR_TIMEOUT_MS: z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined>;
    /**
     * Optional shared secret for the inbound order webhook. Shiprocket does not
     * document signing that callback, so we never trust its body regardless —
     * every payload is re-verified against their Order/Details API. When set,
     * this additionally gates the endpoint on a matching X-Api-Key.
     */
    FASTRR_WEBHOOK_API_KEY: z.ZodOptional<z.ZodString>;
    PHONEPE_MOBILE_REDIRECT_URL: z.ZodOptional<z.ZodString>;
    PHONEPE_WEB_REDIRECT_BASE_URL: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    TRUST_PROXY: number;
    KEEP_ALIVE_TIMEOUT_MS: number;
    HEADERS_TIMEOUT_MS: number;
    REQUEST_TIMEOUT_MS: number;
    JSON_BODY_LIMIT: string;
    URLENCODED_BODY_LIMIT: string;
    MAX_REQUESTS_PER_SOCKET: number;
    BACKEND_WARMUP_INTERVAL_MS: number;
    PRISMA_LOG_QUERIES: boolean;
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    ACCESS_TOKEN_EXPIRY: string;
    REFRESH_TOKEN_EXPIRY: string;
    LIVE_EVENTS_CHANNEL: string;
    RESEND_API_KEY: string;
    EMAIL_FROM: string;
    AQUASMS_BASE_URL: string;
    AQUASMS_SMS_TYPE: string;
    AQUASMS_OTP_TEMPLATE: string;
    AQUASMS_TIMEOUT_MS: number;
    AQUASMS_ALLOW_NON_DLT: boolean;
    FASHN_TRYON_MODEL: "tryon-max" | "tryon-v1.6";
    FASHN_POLL_INTERVAL_MS: number;
    FASHN_POLL_TIMEOUT_MS: number;
    PHONEPE_CLIENT_VERSION: string;
    PHONEPE_ENV: "SANDBOX" | "PRODUCTION";
    FASTRR_ENV: "SANDBOX" | "PRODUCTION";
    FASTRR_CHECKOUT_ENABLED: boolean;
    FASTRR_TIMEOUT_MS: number;
    RUN_BACKGROUND_JOBS?: boolean | undefined;
    BACKEND_WARMUP_URL?: string | undefined;
    DATABASE_URL_DIRECT?: string | undefined;
    FRONTEND_BASE_URL?: string | undefined;
    SELLER_BASE_URL?: string | undefined;
    FRONTEND_REVALIDATE_URL?: string | undefined;
    FRONTEND_REVALIDATE_SECRET?: string | undefined;
    REDIS_URL?: string | undefined;
    UPSTASH_REDIS_REST_URL?: string | undefined;
    UPSTASH_REDIS_REST_TOKEN?: string | undefined;
    AQUASMS_USERNAME?: string | undefined;
    AQUASMS_API_KEY?: string | undefined;
    AQUASMS_SENDER_ID?: string | undefined;
    AQUASMS_DLT_PE_ID?: string | undefined;
    AQUASMS_DLT_TEMPLATE_ID?: string | undefined;
    IMAGEKIT_PUBLIC_KEY?: string | undefined;
    IMAGEKIT_PRIVATE_KEY?: string | undefined;
    IMAGEKIT_URL_ENDPOINT?: string | undefined;
    FASHN_API_KEY?: string | undefined;
    BACKEND_PUBLIC_URL?: string | undefined;
    PHONEPE_MERCHANT_ID?: string | undefined;
    PHONEPE_CLIENT_ID?: string | undefined;
    PHONEPE_CLIENT_SECRET?: string | undefined;
    PHONEPE_WEBHOOK_USERNAME?: string | undefined;
    PHONEPE_WEBHOOK_PASSWORD?: string | undefined;
    SHIPROCKET_API_KEY?: string | undefined;
    FASTRR_API_KEY?: string | undefined;
    FASTRR_API_SECRET?: string | undefined;
    FASTRR_BASE_URL?: string | undefined;
    FASTRR_WEBHOOK_API_KEY?: string | undefined;
    PHONEPE_MOBILE_REDIRECT_URL?: string | undefined;
    PHONEPE_WEB_REDIRECT_BASE_URL?: string | undefined;
}, {
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    RESEND_API_KEY: string;
    EMAIL_FROM: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    PORT?: string | undefined;
    TRUST_PROXY?: string | undefined;
    KEEP_ALIVE_TIMEOUT_MS?: string | undefined;
    HEADERS_TIMEOUT_MS?: string | undefined;
    REQUEST_TIMEOUT_MS?: string | undefined;
    JSON_BODY_LIMIT?: string | undefined;
    URLENCODED_BODY_LIMIT?: string | undefined;
    MAX_REQUESTS_PER_SOCKET?: string | undefined;
    RUN_BACKGROUND_JOBS?: string | undefined;
    BACKEND_WARMUP_URL?: string | undefined;
    BACKEND_WARMUP_INTERVAL_MS?: string | undefined;
    PRISMA_LOG_QUERIES?: string | undefined;
    DATABASE_URL_DIRECT?: string | undefined;
    ACCESS_TOKEN_EXPIRY?: string | undefined;
    REFRESH_TOKEN_EXPIRY?: string | undefined;
    FRONTEND_BASE_URL?: string | undefined;
    SELLER_BASE_URL?: string | undefined;
    FRONTEND_REVALIDATE_URL?: string | undefined;
    FRONTEND_REVALIDATE_SECRET?: string | undefined;
    LIVE_EVENTS_CHANNEL?: string | undefined;
    REDIS_URL?: string | undefined;
    UPSTASH_REDIS_REST_URL?: string | undefined;
    UPSTASH_REDIS_REST_TOKEN?: string | undefined;
    AQUASMS_USERNAME?: string | undefined;
    AQUASMS_API_KEY?: string | undefined;
    AQUASMS_SENDER_ID?: string | undefined;
    AQUASMS_BASE_URL?: string | undefined;
    AQUASMS_SMS_TYPE?: string | undefined;
    AQUASMS_DLT_PE_ID?: string | undefined;
    AQUASMS_DLT_TEMPLATE_ID?: string | undefined;
    AQUASMS_OTP_TEMPLATE?: string | undefined;
    AQUASMS_TIMEOUT_MS?: string | undefined;
    AQUASMS_ALLOW_NON_DLT?: string | undefined;
    IMAGEKIT_PUBLIC_KEY?: string | undefined;
    IMAGEKIT_PRIVATE_KEY?: string | undefined;
    IMAGEKIT_URL_ENDPOINT?: string | undefined;
    FASHN_API_KEY?: string | undefined;
    FASHN_TRYON_MODEL?: "tryon-max" | "tryon-v1.6" | undefined;
    FASHN_POLL_INTERVAL_MS?: string | undefined;
    FASHN_POLL_TIMEOUT_MS?: string | undefined;
    BACKEND_PUBLIC_URL?: string | undefined;
    PHONEPE_MERCHANT_ID?: string | undefined;
    PHONEPE_CLIENT_ID?: string | undefined;
    PHONEPE_CLIENT_SECRET?: string | undefined;
    PHONEPE_CLIENT_VERSION?: string | undefined;
    PHONEPE_ENV?: "SANDBOX" | "PRODUCTION" | undefined;
    PHONEPE_WEBHOOK_USERNAME?: string | undefined;
    PHONEPE_WEBHOOK_PASSWORD?: string | undefined;
    SHIPROCKET_API_KEY?: string | undefined;
    FASTRR_API_KEY?: string | undefined;
    FASTRR_API_SECRET?: string | undefined;
    FASTRR_ENV?: "SANDBOX" | "PRODUCTION" | undefined;
    FASTRR_BASE_URL?: string | undefined;
    FASTRR_CHECKOUT_ENABLED?: string | undefined;
    FASTRR_TIMEOUT_MS?: string | undefined;
    FASTRR_WEBHOOK_API_KEY?: string | undefined;
    PHONEPE_MOBILE_REDIRECT_URL?: string | undefined;
    PHONEPE_WEB_REDIRECT_BASE_URL?: string | undefined;
}>;
/**
 * Parsed and validated environment variables type
 */
export type Env = z.infer<typeof envSchema>;
/**
 * Validated environment configuration
 * Singleton pattern - parsed once on import
 */
export declare const env: Env;
export {};
//# sourceMappingURL=env.d.ts.map