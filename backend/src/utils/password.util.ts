import bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Number of salt rounds for bcrypt hashing
 * Higher = more secure but slower
 */
const SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt
 * @param password - Plain text password to hash
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password to verify
 * @param hashedPassword - Hashed password to compare against
 * @returns True if passwords match, false otherwise
 */
export async function comparePassword(
    password: string,
    hashedPassword: string
): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

/**
 * Hash a refresh token.
 *
 * SHA-256, deliberately NOT bcrypt.
 *
 * bcrypt silently truncates its input at 72 bytes. Our refresh tokens are JWTs of
 * ~230+ bytes whose first 72 bytes are only the base64 header and the opening of the
 * payload — identical for every token issued for the same user and session. The
 * signature, the sole unguessable part, was never covered by the hash. Two
 * consequences, both verified against the live code:
 *
 *   - refresh-token ROTATION did nothing: an old token still validated against the
 *     newly stored hash, so a leaked token stayed usable for the session's lifetime
 *   - the stored hash protected only a predictable prefix
 *
 * A fast hash is also the correct choice here on its own merits: bcrypt's cost exists
 * to slow brute force against LOW-entropy human passwords. A signed JWT is
 * high-entropy, so SHA-256 gives full-length coverage and takes microseconds instead
 * of ~50-100ms — which also removes that cost from every token refresh.
 *
 * Passwords keep using bcrypt (see hashPassword) — that is what it is for.
 */
export async function hashToken(token: string): Promise<string> {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** True when a stored value is a bcrypt hash rather than our SHA-256 hex digest. */
function isLegacyBcryptHash(value: string): boolean {
    return /^\$2[aby]?\$/.test(value);
}

/**
 * Compare a plain text token with a stored token hash.
 *
 * Accepts the legacy bcrypt format so sessions created before the switch keep
 * working — they are upgraded to SHA-256 the next time the token rotates, so no one
 * is signed out by the change.
 */
export async function compareToken(
    token: string,
    hashedToken: string
): Promise<boolean> {
    if (!hashedToken) return false;

    if (isLegacyBcryptHash(hashedToken)) {
        // Pre-existing session. Note this comparison carries the truncation weakness
        // described above; it exists only to avoid forcing every signed-in user to
        // log in again, and each successful refresh replaces it with SHA-256.
        return bcrypt.compare(token, hashedToken);
    }

    const candidate = createHash('sha256').update(token, 'utf8').digest();
    let expected: Buffer;
    try {
        expected = Buffer.from(hashedToken, 'hex');
    } catch {
        return false;
    }

    // Constant-time comparison; timingSafeEqual throws on length mismatch.
    if (expected.length !== candidate.length) return false;
    return timingSafeEqual(candidate, expected);
}
