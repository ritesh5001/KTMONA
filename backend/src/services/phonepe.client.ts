/**
 * PhonePe Client Configuration
 *
 * Handles PhonePe PG (Standard Checkout v2) environment configuration and
 * OAuth access-token lifecycle. The token is cached in-memory and refreshed
 * shortly before expiry.
 */

import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { paymentLogger } from '../config/logger.js';

const HOSTS = {
    SANDBOX: {
        oauth: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
        api: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    },
    PRODUCTION: {
        oauth: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
        api: 'https://api.phonepe.com/apis/pg',
    },
} as const;

/** Refresh the token this many seconds before PhonePe's expires_at. */
const TOKEN_EXPIRY_BUFFER_SECONDS = 120;

interface OAuthTokenResponse {
    access_token: string;
    token_type: string;
    expires_at: number; // epoch seconds
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let inflightTokenRequest: Promise<string> | null = null;

export function isPhonePeConfigured(): boolean {
    return Boolean(env.PHONEPE_CLIENT_ID && env.PHONEPE_CLIENT_SECRET);
}

export function getPhonePeApiBaseUrl(): string {
    return HOSTS[env.PHONEPE_ENV].api;
}

function getOAuthUrl(): string {
    return HOSTS[env.PHONEPE_ENV].oauth;
}

async function fetchAccessToken(): Promise<string> {
    const body = new URLSearchParams({
        client_id: env.PHONEPE_CLIENT_ID!,
        client_version: env.PHONEPE_CLIENT_VERSION,
        client_secret: env.PHONEPE_CLIENT_SECRET!,
        grant_type: 'client_credentials',
    });

    const response = await fetch(getOAuthUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        paymentLogger.error(
            { event: 'phonepe_oauth_failed', status: response.status, body: text.slice(0, 500) },
            'PhonePe OAuth token request failed',
        );
        throw new ApiError(502, `PhonePe auth failed with status ${response.status}`);
    }

    const data = (await response.json()) as OAuthTokenResponse;
    if (!data.access_token || !data.expires_at) {
        throw new ApiError(502, 'PhonePe auth returned an invalid token response');
    }

    cachedToken = { token: data.access_token, expiresAt: data.expires_at };
    return data.access_token;
}

/** Get a valid PhonePe access token (cached until close to expiry). */
export async function getPhonePeAccessToken(): Promise<string> {
    if (!isPhonePeConfigured()) {
        throw new ApiError(500, 'PhonePe is not configured');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.expiresAt - TOKEN_EXPIRY_BUFFER_SECONDS > nowSeconds) {
        return cachedToken.token;
    }

    // Dedupe concurrent refreshes
    if (!inflightTokenRequest) {
        inflightTokenRequest = fetchAccessToken().finally(() => {
            inflightTokenRequest = null;
        });
    }

    return inflightTokenRequest;
}

/** Manual invalidation (e.g. after a 401). */
export function invalidatePhonePeToken(): void {
    cachedToken = null;
}

if (!isPhonePeConfigured()) {
    console.warn('[PhonePe] Warning: PhonePe credentials not configured. PhonePe payments will not work.');
}
