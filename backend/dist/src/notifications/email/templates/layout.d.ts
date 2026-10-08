type DetailItem = {
    label: string;
    value: string | number;
};
type BrandedEmailOptions = {
    preheader?: string;
    eyebrow?: string;
    title: string;
    greeting?: string;
    message: string[];
    details?: DetailItem[];
    ctaLabel?: string;
    ctaUrl?: string;
    accentText?: string;
};
export declare function escapeHtml(value: string | number | null | undefined): string;
export declare function renderBrandedEmail(options: BrandedEmailOptions): string;
export {};
//# sourceMappingURL=layout.d.ts.map