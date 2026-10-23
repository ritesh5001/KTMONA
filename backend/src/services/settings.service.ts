/**
 * Settings Service
 *
 * Thin wrapper over the `app_settings` key-value table for admin-configurable
 * platform settings. Values are cached in-memory for a short TTL so that
 * hot paths (checkout, payment) don't hit the DB on every request.
 *
 * Shipping charge and platform fee: whether each applies and how much (the
 * constants below are only the defaults until an admin saves an amount).
 */

import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

/** Default shipping fee (INR) per order when shipping is enabled and no amount is saved. */
export const DEFAULT_SHIPPING_FEE_INR = 180;

/**
 * Default platform fee (INR) when none is saved. Historically called the "flat
 * GST charge"; it is a KTMONA fee, charged per item by default.
 */
export const FLAT_GST_FEE_INR = 180;

export type PlatformFeeMode = 'PER_ITEM' | 'PER_ORDER';

export interface PlatformFeeRules {
    enabled: boolean;
    amount: number;
    mode: PlatformFeeMode;
}

/** Setting keys stored in the `app_settings` table. */
export const SETTING_KEYS = {
    SHIPPING_CHARGE_ENABLED: 'shipping_charge_enabled',
    GST_CHARGE_ENABLED: 'gst_charge_enabled',
    COD_ENABLED: 'cod_enabled',
    /** Orders whose subtotal (after coupon) reaches this ship free. 0 = no offer. */
    FREE_SHIPPING_MIN_ORDER: 'free_shipping_min_order',
    /** Shipping fee amount in INR. */
    SHIPPING_FEE_AMOUNT: 'shipping_fee_amount',
    /** Platform fee amount in INR, and whether it is per item or per order. */
    PLATFORM_FEE_AMOUNT: 'platform_fee_amount',
    PLATFORM_FEE_MODE: 'platform_fee_mode',
} as const;

function parseAmount(raw: string | null, fallback: number): number {
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Orders above this total cannot be paid cash on delivery (courier cash limit). */
export const COD_MAX_ORDER_INR = 50000;

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
        return enabled ? await this.getShippingFeeAmount() : 0;
    },

    /** The shipping fee amount (INR), whether or not it is switched on. */
    async getShippingFeeAmount(): Promise<number> {
        return parseAmount(await readRaw(SETTING_KEYS.SHIPPING_FEE_AMOUNT), DEFAULT_SHIPPING_FEE_INR);
    },

    async setShippingFeeAmount(amount: number): Promise<number> {
        const value = Math.max(0, Math.round(amount * 100) / 100);
        await writeRaw(SETTING_KEYS.SHIPPING_FEE_AMOUNT, String(value));
        settingsLogger.info({ event: 'shipping_fee_amount_set', value }, 'Shipping fee amount updated by admin');
        return value;
    },

    /** Platform fee: on/off, amount and per-item vs per-order. */
    async getPlatformFeeRules(): Promise<PlatformFeeRules> {
        const [enabled, amountRaw, modeRaw] = await Promise.all([
            this.isGstChargeEnabled(),
            readRaw(SETTING_KEYS.PLATFORM_FEE_AMOUNT),
            readRaw(SETTING_KEYS.PLATFORM_FEE_MODE),
        ]);
        return {
            enabled,
            amount: parseAmount(amountRaw, FLAT_GST_FEE_INR),
            mode: modeRaw === 'PER_ORDER' ? 'PER_ORDER' : 'PER_ITEM',
        };
    },

    async setPlatformFee(input: { amount?: number | undefined; mode?: PlatformFeeMode | undefined }): Promise<PlatformFeeRules> {
        if (input.amount !== undefined) {
            await writeRaw(SETTING_KEYS.PLATFORM_FEE_AMOUNT, String(Math.max(0, Math.round(input.amount * 100) / 100)));
        }
        if (input.mode !== undefined) {
            await writeRaw(SETTING_KEYS.PLATFORM_FEE_MODE, input.mode);
        }
        settingsLogger.info({ event: 'platform_fee_set', ...input }, 'Platform fee updated by admin');
        return this.getPlatformFeeRules();
    },

    /** Free-delivery threshold in INR (0 = no free-delivery offer). */
    async getFreeShippingMinOrder(): Promise<number> {
        const raw = await readRaw(SETTING_KEYS.FREE_SHIPPING_MIN_ORDER);
        const value = raw === null ? 0 : Number(raw);
        return Number.isFinite(value) && value > 0 ? value : 0;
    },

    async setFreeShippingMinOrder(amount: number): Promise<number> {
        const value = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
        await writeRaw(SETTING_KEYS.FREE_SHIPPING_MIN_ORDER, String(value));
        settingsLogger.info({ event: 'free_shipping_threshold_set', value }, 'Free delivery threshold updated by admin');
        return value;
    },

    /**
     * Everything needed to price delivery: the flat fee (0 when switched off) and
     * the free-delivery threshold.
     */
    async getShippingRules(): Promise<{ fee: number; freeAbove: number }> {
        const [enabled, freeAbove] = await Promise.all([
            this.isShippingChargeEnabled(),
            this.getFreeShippingMinOrder(),
        ]);
        return { fee: enabled ? await this.getShippingFeeAmount() : 0, freeAbove };
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
        return platformFeeFor(totalQty, await this.getPlatformFeeRules());
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

    /**
     * Whether Cash on Delivery is offered at checkout. Defaults to `true`
     * when the setting has never been saved.
     */
    async isCodEnabled(): Promise<boolean> {
        const raw = await readRaw(SETTING_KEYS.COD_ENABLED);
        if (raw === null) return true;
        return raw === 'true';
    },

    /** Turn Cash on Delivery on or off for new orders. */
    async setCodEnabled(enabled: boolean): Promise<boolean> {
        await writeRaw(SETTING_KEYS.COD_ENABLED, enabled ? 'true' : 'false');
        settingsLogger.info(
            { event: 'cod_toggled', enabled },
            `Cash on Delivery ${enabled ? 'enabled' : 'disabled'} by admin`,
        );
        return enabled;
    },
};

/** Delivery charge for an order whose subtotal (after coupon, before tax) is `subtotal`. */
export function shippingFeeFor(subtotal: number, rules: { fee: number; freeAbove: number }): number {
    if (rules.fee <= 0) return 0;
    if (rules.freeAbove > 0 && subtotal >= rules.freeAbove) return 0;
    return rules.fee;
}

/** Platform fee for an order with `units` items under these rules. */
export function platformFeeFor(units: number, rules: PlatformFeeRules): number {
    if (!rules.enabled || units <= 0 || rules.amount <= 0) return 0;
    return rules.mode === 'PER_ORDER' ? rules.amount : rules.amount * units;
}
