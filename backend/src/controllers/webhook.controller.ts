
import { Request, Response } from 'express';
import { webhookService } from '../services/webhook.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

export class WebhookController {

    handleWebhook = asyncHandler(async (req: Request, res: Response) => {
        const provider = req.params['provider'];
        if (!provider || typeof provider !== 'string') {
            throw new Error('Provider is required');
        }

        // Razorpay signs the exact bytes it sent; app.ts keeps them as rawBody.
        const signature = (req.headers['x-razorpay-signature'] as string) || '';
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

        await webhookService.processWebhook(provider, rawBody, req.body, signature);

        res.status(200).json({ success: true, message: 'Webhook processed' });
    });
}

export const webhookController = new WebhookController();
