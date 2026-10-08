import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { authLogger } from '../config/logger.js';
import { normalizeIndianMobile } from '../utils/phone.util.js';

const logger = authLogger.child({ component: 'aquasms' });

/**
 * AquaSMS responses are JSON arrays, and the shape differs between success and
 * failure. Observed against the live API:
 *   credit  : [[5000,"TRANS"]]
 *   failure : [{"responseCode":"Sender Name Invalid"}]
 *   failure : [{"responseCode":"Empty Number"}]
 * Success carries a message id, which is what getDLR later looks up.
 */
type AquaSmsRow = {
    responseCode?: string;
    msgid?: string | number;
    msgId?: string | number;
    messageId?: string | number;
    [key: string]: unknown;
};

const SUCCESS_HINT = /success|sent|submitted|accepted/i;

/**
 * Whether SMS is usable as a real delivery channel.
 *
 * What actually determines delivery on this account is that the message text matches
 * a template registered in the AquaSMS panel. AquaSMS maps that text to the DLT
 * registration itself, so we do NOT need to pass peid/templateid — verified against
 * the live API:
 *
 *   text not matching any template  -> "Message SuccessFully Submitted", then UNDELIV
 *   text matching template 16672    -> "Message SuccessFully Submitted", then DELIVRD
 *
 * Both were billed a credit, so the submit response tells you nothing about delivery.
 * AQUASMS_ALLOW_NON_DLT=true reflects that arrangement: credentials plus a sender id
 * are enough here. If it is off we additionally require the explicit DLT ids, which
 * remains the correct default for an account without provider-side template mapping.
 *
 * The gate matters because otherwise `deliverOtp` would treat a submitted-but-dropped
 * message as delivered and skip the email fallback, leaving the user with no code.
 *
 * AQUASMS_OTP_TEMPLATE must stay character-for-character identical to the registered
 * template. Editing its wording silently breaks delivery while still reporting
 * success and consuming credits.
 */
export function isSmsConfigured(): boolean {
    const hasCredentials = Boolean(
        env.AQUASMS_USERNAME && env.AQUASMS_API_KEY && env.AQUASMS_SENDER_ID,
    );
    if (!hasCredentials) return false;
    return hasDltConfig() || env.AQUASMS_ALLOW_NON_DLT;
}

/** True when DLT parameters are present, so the v2 (DLT) endpoint can be used. */
function hasDltConfig(): boolean {
    return Boolean(env.AQUASMS_DLT_PE_ID && env.AQUASMS_DLT_TEMPLATE_ID);
}

let warnedAboutMissingDlt = false;

/**
 * Warn when nothing guarantees delivery: no DLT ids AND no provider-side template
 * mapping (AQUASMS_ALLOW_NON_DLT). In that state the provider still accepts the
 * message and bills a credit — "Message SuccessFully Submitted" with a message id —
 * but the operator drops it and the delivery report comes back UNDELIV. Submission
 * is not delivery, so say so once rather than quietly burning credits.
 */
function warnIfDltMissing(): void {
    if (hasDltConfig() || env.AQUASMS_ALLOW_NON_DLT || warnedAboutMissingDlt) return;
    warnedAboutMissingDlt = true;
    logger.warn(
        { event: 'sms_dlt_not_configured' },
        'AQUASMS_DLT_PE_ID / AQUASMS_DLT_TEMPLATE_ID are not set. Messages will be ' +
        'accepted and billed but Indian operators will almost certainly not deliver them.',
    );
}

/**
 * Extract a provider message id from a successful response, if one is present.
 * Used only for logging/troubleshooting via the getDLR endpoint.
 */
function extractMessageId(rows: AquaSmsRow[]): string | null {
    for (const row of rows) {
        const id = row.msgid ?? row.msgId ?? row.messageId;
        if (id !== undefined && id !== null && String(id).trim() !== '') {
            return String(id);
        }
    }
    return null;
}

/**
 * Decide whether a 200 response actually means "delivered to the operator".
 *
 * AquaSMS returns HTTP 200 for errors too — the only signal is the body — so this
 * is deliberately fail-closed: anything not positively recognised as success is
 * treated as a failure. Reporting a false "OTP sent" is far worse than a retry,
 * because the user waits for a code that will never arrive.
 */
function interpretResponse(raw: string): { ok: true; messageId: string | null } | { ok: false; reason: string } {
    const text = raw.trim();
    if (!text) {
        return { ok: false, reason: 'Empty response from SMS provider' };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        // Some gateways return a bare message id as plain text.
        if (/^[A-Za-z0-9_-]{6,}$/.test(text) && !/error|invalid|fail/i.test(text)) {
            return { ok: true, messageId: text };
        }
        return { ok: false, reason: text.slice(0, 200) };
    }

    const rows: AquaSmsRow[] = Array.isArray(parsed)
        ? (parsed.filter((r) => r && typeof r === 'object') as AquaSmsRow[])
        : parsed && typeof parsed === 'object'
            ? [parsed as AquaSmsRow]
            : [];

    if (rows.length === 0) {
        return { ok: false, reason: text.slice(0, 200) };
    }

    // Any row carrying a responseCode that is not a success word is an error,
    // e.g. "Sender Name Invalid", "Empty Number", "Insufficient Credit".
    const errorRow = rows.find(
        (row) => typeof row.responseCode === 'string' && !SUCCESS_HINT.test(row.responseCode),
    );
    if (errorRow) {
        return { ok: false, reason: String(errorRow.responseCode) };
    }

    const messageId = extractMessageId(rows);
    const hasSuccessCode = rows.some(
        (row) => typeof row.responseCode === 'string' && SUCCESS_HINT.test(row.responseCode),
    );

    if (messageId || hasSuccessCode) {
        return { ok: true, messageId };
    }

    // Unrecognised shape — refuse to call it a success.
    return { ok: false, reason: `Unrecognised SMS provider response: ${text.slice(0, 200)}` };
}

class AquaSmsService {
    /**
     * Send a transactional SMS.
     *
     * Uses the DLT (v2) endpoint when explicit peid/templateid are configured.
     * This account does not need them: AquaSMS maps the message to the registered
     * DLT template by its TEXT, so the plain endpoint delivers as long as `message`
     * matches a template in the panel character for character.
     */
    async sendSms(phone: string, message: string): Promise<{ messageId: string | null }> {
        if (!env.AQUASMS_USERNAME || !env.AQUASMS_API_KEY) {
            throw ApiError.internal('SMS provider credentials are not configured');
        }
        if (!env.AQUASMS_SENDER_ID) {
            throw ApiError.internal('SMS sender id (AQUASMS_SENDER_ID) is not configured');
        }

        const numbers = normalizeIndianMobile(phone);
        if (!/^\d{10}$/.test(numbers)) {
            throw ApiError.badRequest('A valid 10-digit mobile number is required');
        }

        warnIfDltMissing();

        const useDlt = hasDltConfig();
        const params = new URLSearchParams({
            username: env.AQUASMS_USERNAME,
            apikey: env.AQUASMS_API_KEY,
            sendername: env.AQUASMS_SENDER_ID,
            smstype: env.AQUASMS_SMS_TYPE,
            numbers,
            message,
        });

        if (useDlt) {
            params.set('peid', env.AQUASMS_DLT_PE_ID!);
            params.set('templateid', env.AQUASMS_DLT_TEMPLATE_ID!);
        }

        const url = `${env.AQUASMS_BASE_URL}${useDlt ? '/v2/sendSMS' : '/sendSMS'}?${params.toString()}`;

        // The provider has been slow to respond on a cold connection; without a
        // timeout a stalled request would hold the auth request open indefinitely.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), env.AQUASMS_TIMEOUT_MS);

        let raw: string;
        try {
            const response = await fetch(url, { method: 'GET', signal: controller.signal });
            raw = await response.text();
            if (!response.ok) {
                throw ApiError.internal(
                    `SMS provider returned HTTP ${response.status}: ${raw.slice(0, 200)}`,
                );
            }
        } catch (err) {
            if (err instanceof ApiError) throw err;
            const reason =
                err instanceof Error && err.name === 'AbortError'
                    ? `timed out after ${env.AQUASMS_TIMEOUT_MS}ms`
                    : err instanceof Error
                        ? err.message
                        : String(err);
            throw ApiError.internal(`Could not reach the SMS provider (${reason})`);
        } finally {
            clearTimeout(timer);
        }

        const result = interpretResponse(raw);
        if (!result.ok) {
            // Log the phone, never the message — it contains the OTP.
            logger.error({ event: 'sms_send_failed', phone: numbers, dlt: useDlt, reason: result.reason }, 'AquaSMS send failed');
            throw ApiError.internal(`SMS delivery failed: ${result.reason}`);
        }

        logger.info(
            { event: 'sms_sent', phone: numbers, dlt: useDlt, messageId: result.messageId },
            'SMS sent',
        );
        return { messageId: result.messageId };
    }

    /** Remaining SMS credits, by route. Useful for a health check / admin view. */
    async getBalance(): Promise<string> {
        if (!env.AQUASMS_USERNAME || !env.AQUASMS_API_KEY) {
            throw ApiError.internal('SMS provider credentials are not configured');
        }
        const params = new URLSearchParams({
            username: env.AQUASMS_USERNAME,
            apikey: env.AQUASMS_API_KEY,
        });
        const response = await fetch(`${env.AQUASMS_BASE_URL}/getSMSCredit?${params.toString()}`);
        return (await response.text()).trim();
    }
}

export const aquaSmsService = new AquaSmsService();
