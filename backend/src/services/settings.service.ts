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

import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

/** Flat shipping fee (INR) applied per order when shipping is enabled. */
export const DEFAULT_SHIPPING_FEE_INR = 180;

/** Flat GST fee (INR) applied per unit when the flat GST charge is enabled. */
export const FLAT_GST_FEE_INR = 180;

/** Setting keys stored in the `app_settings` table. */
export const SETTING_KEYS = {
    SHIPPING_CHARGE_ENABLED: 'shipping_charge_enabled',
    GST_CHARGE_ENABLED: 'gst_charge_enabled',
} as const;

const settingsLogger = logger.child({ module: 'settings' });

/**
 * How long a resolved setting stays cached in-memory before re-reading.
 *
 * 5 minutes, not 30 seconds: every checkout reads the shipping and GST toggles, so a
 * short TTL meant most buyers paid a cross-region round-trip mid-order for a value
 * that changes maybe once a month. Staleness is bounded well below this in practice —
 * writeRaw() refreshes the entry on save, and the catalog warmup re-reads these keys
 * every 4 minutes, so the cache is normally refreshed before it can expire.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { value: string; expiresAt: number }>();

async function readRaw(key: string): Promise<string | null> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (!row) {
        cache.delete(key);
        return null;
    }

    cache.set(key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS });
    return row.value;
}

async function writeRaw(key: string, value: string): Promise<void> {
    await prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
    });
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export const settingsService = {
    /**
     * Whether the flat shipping charge is currently applied to new orders.
     * Defaults to `true` (charge applied) when the setting is missing so that
     * behaviour is preserved even before the row is seeded.
     */
    async isShippingChargeEnabled(): Promise<boolean> {
        const raw = await readRaw(SETTING_KEYS.SHIPPING_CHARGE_ENABLED);
        if (raw === null) return true;
        return raw === 'true';
    },

    /**
     * Resolve the shipping fee (INR) to charge for an order.
     * Returns 0 when shipping is disabled or the order has no billable items.
     */
    async getShippingFee(hasItems: boolean): Promise<number> {
        if (!hasItems) return 0;
        const enabled = await this.isShippingChargeEnabled();
        return enabled ? DEFAULT_SHIPPING_FEE_INR : 0;
    },

    /** Enable or disable the flat shipping charge for new orders. */
    async setShippingChargeEnabled(enabled: boolean): Promise<boolean> {
        await writeRaw(SETTING_KEYS.SHIPPING_CHARGE_ENABLED, enabled ? 'true' : 'false');
        settingsLogger.info(
            { event: 'shipping_charge_toggled', enabled },
            `Shipping charge ${enabled ? 'enabled' : 'disabled'} by admin`,
        );
        return enabled;
    },

    /**
     * Whether the flat GST charge is currently applied to new orders.
     * Defaults to `true` (charge applied) when the setting is missing so that
     * behaviour is preserved even before the row is seeded.
     */
    async isGstChargeEnabled(): Promise<boolean> {
        const raw = await readRaw(SETTING_KEYS.GST_CHARGE_ENABLED);
        if (raw === null) return true;
        return raw === 'true';
    },

    /**
     * Resolve the flat GST fee (INR) to charge for an order.
     * Returns 0 when the flat GST charge is disabled or there are no units.
     */
    async getFlatGstFee(totalQty: number): Promise<number> {
        if (totalQty <= 0) return 0;
        const enabled = await this.isGstChargeEnabled();
        return enabled ? FLAT_GST_FEE_INR * totalQty : 0;
    },

    /** Enable or disable the flat GST charge for new orders. */
    async setGstChargeEnabled(enabled: boolean): Promise<boolean> {
        await writeRaw(SETTING_KEYS.GST_CHARGE_ENABLED, enabled ? 'true' : 'false');
        settingsLogger.info(
            { event: 'gst_charge_toggled', enabled },
            `Flat GST charge ${enabled ? 'enabled' : 'disabled'} by admin`,
        );
        return enabled;
    },
};
