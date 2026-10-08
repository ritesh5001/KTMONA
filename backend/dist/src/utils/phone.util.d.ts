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
export declare function normalizeIndianMobile(input: string): string;
/** True when the value is a plausible Indian mobile number (10 digits, starts 6-9). */
export declare function isValidIndianMobile(input: string): boolean;
//# sourceMappingURL=phone.util.d.ts.map