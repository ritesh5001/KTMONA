/**
 * PhonePe Client Configuration
 *
 * Handles PhonePe PG (Standard Checkout v2) environment configuration and
 * OAuth access-token lifecycle. The token is cached in-memory and refreshed
 * shortly before expiry.
 */
export declare function isPhonePeConfigured(): boolean;
export declare function getPhonePeApiBaseUrl(): string;
/** Get a valid PhonePe access token (cached until close to expiry). */
export declare function getPhonePeAccessToken(): Promise<string>;
/** Manual invalidation (e.g. after a 401). */
export declare function invalidatePhonePeToken(): void;
//# sourceMappingURL=phonepe.client.d.ts.map