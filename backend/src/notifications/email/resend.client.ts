import { Resend } from 'resend';
import { env } from '../../config/env.js';

// Initialize Resend with API Key from env
export const resend = new Resend(env.RESEND_API_KEY);

/**
 * Send an email using Resend
 * Supports mocking in test environment
 */
export async function sendEmail(to: string, subject: string, html: string) {
    if (env.NODE_ENV === 'test' || process.env.MOCK_EMAIL === 'true') {
        console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
        return { id: `mock_${Date.now()}` };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: env.EMAIL_FROM,
            to,
            subject,
            html
        });

        if (error) {
            throw new Error(`Resend Error: ${error.message}`);
        }

        return data; // { id: string }
    } catch (error) {
        console.error('Email Send Failed:', error);
        throw error;
    }
}
