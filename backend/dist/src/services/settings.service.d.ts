/**
 * Settings Service
 *
 * Thin wrapper over the `app_settings` key-value table for admin-configurable
 * platform settings. Values are cached in-memory for a short TTL so that
 * hot paths (checkout, payment) don't hit the DB on every request.
 *
 * Currently exposes the shipping-charge and flat-GST toggles. The fee amounts
 * themselves stay code constants (DEFAULT_SHIPPING_FEE_INR / FLAT_GST_FEE_INR);
 * only whether they are applied is admin-controllable.
 */
/** Flat shipping fee (INR) applied per order when shipping is enabled. */
export declare const DEFAULT_SHIPPING_FEE_INR = 180;
/** Flat GST fee (INR) applied per unit when the flat GST charge is enabled. */
export declare const FLAT_GST_FEE_INR = 180;
/** Setting keys stored in the `app_settings` table. */
export declare const SETTING_KEYS: {
    readonly SHIPPING_CHARGE_ENABLED: "shipping_charge_enabled";
    readonly GST_CHARGE_ENABLED: "gst_charge_enabled";
};
export declare const settingsService: {
    /**
     * Whether the flat shipping charge is currently applied to new orders.
     * Defaults to `true` (charge applied) when the setting is missing so that
     * behaviour is preserved even before the row is seeded.
     */
    isShippingChargeEnabled(): Promise<boolean>;
    /**
     * Resolve the shipping fee (INR) to charge for an order.
     * Returns 0 when shipping is disabled or the order has no billable items.
     */
    getShippingFee(hasItems: boolean): Promise<number>;
    /** Enable or disable the flat shipping charge for new orders. */
    setShippingChargeEnabled(enabled: boolean): Promise<boolean>;
    /**
     * Whether the flat GST charge is currently applied to new orders.
     * Defaults to `true` (charge applied) when the setting is missing so that
     * behaviour is preserved even before the row is seeded.
     */
    isGstChargeEnabled(): Promise<boolean>;
    /**
     * Resolve the flat GST fee (INR) to charge for an order.
     * Returns 0 when the flat GST charge is disabled or there are no units.
     */
    getFlatGstFee(totalQty: number): Promise<number>;
    /** Enable or disable the flat GST charge for new orders. */
    setGstChargeEnabled(enabled: boolean): Promise<boolean>;
};
//# sourceMappingURL=settings.service.d.ts.map