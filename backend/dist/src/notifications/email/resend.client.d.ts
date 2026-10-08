import { Resend } from 'resend';
export declare const resend: Resend;
/**
 * Send an email using Resend
 * Supports mocking in test environment
 */
export declare function sendEmail(to: string, subject: string, html: string): Promise<{
    id: string;
}>;
//# sourceMappingURL=resend.client.d.ts.map