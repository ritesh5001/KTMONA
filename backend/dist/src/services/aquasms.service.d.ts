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
export declare function isSmsConfigured(): boolean;
declare class AquaSmsService {
    /**
     * Send a transactional SMS.
     *
     * Uses the DLT (v2) endpoint when explicit peid/templateid are configured.
     * This account does not need them: AquaSMS maps the message to the registered
     * DLT template by its TEXT, so the plain endpoint delivers as long as `message`
     * matches a template in the panel character for character.
     */
    sendSms(phone: string, message: string): Promise<{
        messageId: string | null;
    }>;
    /** Remaining SMS credits, by route. Useful for a health check / admin view. */
    getBalance(): Promise<string>;
}
export declare const aquaSmsService: AquaSmsService;
export {};
//# sourceMappingURL=aquasms.service.d.ts.map