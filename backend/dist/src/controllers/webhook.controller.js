import { webhookService } from '../services/webhook.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
export class WebhookController {
    handleWebhook = asyncHandler(async (req, res) => {
        const provider = req.params['provider'];
        if (!provider || typeof provider !== 'string') {
            throw new Error('Provider is required');
        }
        // PhonePe sends its auth digest in the Authorization header.
        const signature = req.headers['authorization'] ||
            req.headers['x-verify'] ||
            '';
        // Fastrr identifies itself with X-Api-Key rather than a signed digest.
        const apiKey = req.headers['x-api-key'] || '';
        await webhookService.processWebhook(provider, req.body, signature, apiKey);
        res.status(200).json({ success: true, message: 'Webhook processed' });
    });
}
export const webhookController = new WebhookController();
//# sourceMappingURL=webhook.controller.js.map