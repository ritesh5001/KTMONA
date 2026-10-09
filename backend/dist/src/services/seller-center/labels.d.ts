/**
 * KTMONA shipping labels (4x6 in) and pickup manifests (A4), as PDF buffers.
 */
export interface LabelData {
    orderId: string;
    orderDate: Date;
    awb: string | null;
    courier: string;
    paymentMode: 'PREPAID' | 'COD';
    codAmount: number;
    shipTo: {
        name: string;
        phone: string;
        line1: string;
        line2?: string | null;
        city: string;
        pincode: string;
    };
    returnTo: {
        name: string;
        phone: string;
        line1: string;
        line2?: string | null;
        city: string;
        state?: string | null;
        pincode: string;
    };
    items: {
        title: string;
        sku: string;
        size: string;
        color?: string | null;
        quantity: number;
    }[];
    gstin?: string | null;
}
/** One 4x6 label per shipment, all in a single PDF. */
export declare function renderLabels(labels: LabelData[]): Promise<Buffer>;
export interface ManifestData {
    manifestId: string;
    createdAt: Date;
    seller: {
        storeName: string;
        sellerCode: string;
        address: string;
    };
    rows: {
        orderId: string;
        awb: string | null;
        courier: string;
        items: number;
        paymentMode: string;
    }[];
}
export declare function renderManifest(data: ManifestData): Promise<Buffer>;
//# sourceMappingURL=labels.d.ts.map