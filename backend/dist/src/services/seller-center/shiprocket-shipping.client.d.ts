/**
 * Shiprocket shipping API (apiv2.shiprocket.in): create order → assign AWB →
 * label → pickup → manifest. Used when SHIPROCKET_EMAIL/PASSWORD are set;
 * otherwise sellers self-ship.
 */
export declare function isShiprocketShippingEnabled(): boolean;
export interface ShiprocketOrderInput {
    orderId: string;
    orderDate: Date;
    pickupLocation: string;
    customer: {
        name: string;
        phone: string;
        email?: string | null;
        address: string;
        address2?: string | null;
        city: string;
        pincode: string;
        state?: string | null;
    };
    items: {
        name: string;
        sku: string;
        units: number;
        sellingPrice: number;
        hsn?: string | null;
    }[];
    paymentMethod: 'Prepaid' | 'COD';
    subTotal: number;
    weightKg: number;
    dimensionsCm: {
        length: number;
        breadth: number;
        height: number;
    };
}
export interface ShiprocketBooking {
    shiprocketOrderId: string;
    shipmentId: string;
    awb: string;
    courier: string;
    labelUrl: string | null;
}
/** Create the order, assign an AWB and fetch the label in one go. */
export declare function bookShipment(input: ShiprocketOrderInput): Promise<ShiprocketBooking>;
export declare function requestPickup(shipmentIds: string[]): Promise<void>;
export declare function generateManifest(shipmentIds: string[]): Promise<string | null>;
/**
 * Register (or re-register) a seller's pickup address. Shiprocket only books
 * pickups from named locations, so the seller code is used as the name.
 */
export declare function upsertPickupLocation(input: {
    name: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    address2?: string | null | undefined;
    city: string;
    state: string;
    pincode: string;
}): Promise<void>;
//# sourceMappingURL=shiprocket-shipping.client.d.ts.map