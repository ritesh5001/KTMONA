/**
 * Reduce any Indian mobile input to its bare 10 digits.
 *
 * Accepts the shapes users and forms actually produce: +91 98765 43210,
 * 0091-9876543210, 09876543210, 9876543210. Anything else is returned as digits
 * only, so callers can validate with /^\d{10}$/ and fail loudly.
 *
 * Lives in utils rather than next to an SMS provider: it is used across auth,
 * OTP and profile code, and must not be tied to whichever vendor sends messages.
 */
export function normalizeIndianMobile(input: string): string {
    const digits = (input ?? '').replace(/\D/g, '');

    // 0091XXXXXXXXXX
    if (digits.length === 14 && digits.startsWith('0091')) {
        return digits.slice(4);
    }
    // 91XXXXXXXXXX
    if (digits.length === 12 && digits.startsWith('91')) {
        return digits.slice(2);
    }
    // 0XXXXXXXXXX (STD trunk prefix)
    if (digits.length === 11 && digits.startsWith('0')) {
        return digits.slice(1);
    }

    return digits;
}

/** True when the value is a plausible Indian mobile number (10 digits, starts 6-9). */
export function isValidIndianMobile(input: string): boolean {
    return /^[6-9]\d{9}$/.test(normalizeIndianMobile(input));
}
