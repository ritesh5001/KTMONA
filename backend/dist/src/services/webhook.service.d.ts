export declare class WebhookService {
    processWebhook(provider: string, payload: any, signature: string, apiKey?: string): Promise<void>;
    private handleFastrrWebhook;
    private handlePhonePeWebhook;
}
export declare const webhookService: WebhookService;
//# sourceMappingURL=webhook.service.d.ts.map