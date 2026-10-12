/**
 * Orders-page packaging tools, Meesho-style:
 *
 *  - Label retry: when Shiprocket fails to generate a label at booking, the
 *    order still proceeds (the seller can print KTMONA's own label) and this
 *    sweep keeps asking Shiprocket until the courier label is ready, then
 *    tells the seller. Orders are never blocked by it.
 *  - Barcoded packaging: the policy banner's "Buy Barcoded Packets" shows the
 *    packaging supplier an admin configured; "Scan Barcoded Packets" records
 *    which packet each order was packed in (one packet, one order).
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../errors/ApiError.js';
import { notificationService } from '../../notifications/notification.service.js';
import { generateLabel, isShiprocketShippingEnabled } from './shiprocket-shipping.client.js';

const log = logger.child({ module: 'seller-packaging' });
const SUPPLIER_KEY = 'seller.packaging_supplier';
const RETRY_BATCH = 20;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

export const packagingSupplierSchema = z.object({
    enabled: z.boolean().default(true),
    shopName: z.string().trim().min(2, 'Enter the supplier shop name').max(120),
    contactName: optionalText(80),
    phone: optionalText(20),
    whatsapp: optionalText(20),
    email: z.string().trim().email('Enter a valid email').max(160).nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
    address: optionalText(400),
    website: z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Link must start with http:// or https://')
        .nullable()
        .optional()
        .transform((v) => (v ? v : null)),
    priceNote: optionalText(600),
    notes: optionalText(1000),
});

export type PackagingSupplier = z.infer<typeof packagingSupplierSchema>;

export const packetScanSchema = z.object({
    barcode: z
        .string()
        .trim()
        .min(4, 'Scan or type the packet barcode')
        .max(64)
        .regex(/^[A-Za-z0-9\-_.]+$/, 'Barcode can only contain letters, numbers, - _ .'),
});

class SellerPackagingService {
    // ── Supplier (admin-managed) ─────────────────────────────────────────
    async getSupplier(): Promise<PackagingSupplier | null> {
        const row = await prisma.appSetting.findUnique({ where: { key: SUPPLIER_KEY } });
        if (!row) return null;
        try {
            return packagingSupplierSchema.parse(JSON.parse(row.value));
        } catch {
            return null;
        }
    }

    /** What sellers see: nothing when the admin has not set a supplier or turned it off. */
    async publicSupplier() {
        const s = await this.getSupplier();
        return { supplier: s && s.enabled ? s : null };
    }

    async saveSupplier(input: unknown) {
        const data = packagingSupplierSchema.parse(input);
        const value = JSON.stringify(data);
        await prisma.appSetting.upsert({ where: { key: SUPPLIER_KEY }, create: { key: SUPPLIER_KEY, value }, update: { value } });
        return { supplier: data };
    }

    // ── Label status + retry ─────────────────────────────────────────────
    /** Shipments still waiting for the courier label (drives the Orders banner). */
    async labelStatus(sellerId: string) {
        const pending = await prisma.shipments.count({
            where: {
                seller_id: sellerId,
                fulfillment_mode: 'SHIPROCKET',
                shiprocket_shipment_id: { not: null },
                label_url: null,
                status: 'CREATED',
            },
        });
        return { pendingLabels: pending };
    }

    /** Maintenance sweep: retry missing Shiprocket labels and notify sellers when ready. */
    async retryMissingLabels(): Promise<number> {
        if (!isShiprocketShippingEnabled()) return 0;
        const due = await prisma.shipments.findMany({
            where: { fulfillment_mode: 'SHIPROCKET', shiprocket_shipment_id: { not: null }, label_url: null, status: 'CREATED' },
            select: { id: true, order_id: true, seller_id: true, shiprocket_shipment_id: true },
            orderBy: { created_at: 'asc' },
            take: RETRY_BATCH,
        });
        let fixed = 0;
        for (const s of due) {
            try {
                const url = await generateLabel(s.shiprocket_shipment_id!);
                if (!url) continue;
                await prisma.shipments.update({ where: { id: s.id }, data: { label_url: url, label_generated_at: new Date(), updated_at: new Date() } });
                fixed += 1;
                await notificationService
                    .create({
                        userId: s.seller_id,
                        role: 'SELLER',
                        type: 'ADMIN_ALERT',
                        channel: 'EMAIL',
                        content: `Shipping label ready for order ${s.order_id.slice(0, 8).toUpperCase()}`,
                        metadata: {
                            title: 'Shipping label is ready',
                            message: `The courier label for order ${s.order_id.slice(0, 8).toUpperCase()} is ready. Download it from Orders → Ready to Ship.`,
                        },
                        eventKey: `LABEL_READY:${s.id}`,
                    })
                    .catch(() => undefined);
            } catch (err) {
                log.warn({ err: err instanceof Error ? err.message : String(err), shipmentId: s.id }, 'label_retry_failed');
            }
        }
        if (fixed) log.info({ fixed, tried: due.length }, 'label_retry_done');
        return fixed;
    }

    // ── Barcoded packets ─────────────────────────────────────────────────
    /** Accepted orders waiting to be packed, with any packet already scanned. */
    async packetQueue(sellerId: string) {
        const rows = await prisma.shipments.findMany({
            where: { seller_id: sellerId, status: 'CREATED' },
            orderBy: { created_at: 'desc' },
            take: 100,
            select: { id: true, order_id: true, packet_barcode: true, packet_scanned_at: true, tracking_number: true, carrier: true },
        });
        return {
            orders: rows.map((r) => ({
                orderId: r.order_id,
                shipmentId: r.id,
                awb: r.tracking_number || null,
                carrier: r.carrier,
                packetBarcode: r.packet_barcode,
                scannedAt: r.packet_scanned_at,
            })),
        };
    }

    async recordPacket(sellerId: string, orderId: string, input: z.infer<typeof packetScanSchema>) {
        const shipment = await prisma.shipments.findFirst({ where: { order_id: orderId, seller_id: sellerId } });
        if (!shipment) throw ApiError.badRequest('Accept the order first; packets are scanned for orders ready to ship');
        if (shipment.status !== 'CREATED') throw ApiError.badRequest('This order has already been handed over to the courier');
        try {
            await prisma.shipments.update({
                where: { id: shipment.id },
                data: { packet_barcode: input.barcode.toUpperCase(), packet_scanned_at: new Date(), updated_at: new Date() },
            });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw ApiError.conflict('This packet barcode is already used for another order. Use a new packet.');
            }
            throw err;
        }
        return this.packetQueue(sellerId);
    }
}

export const sellerPackagingService = new SellerPackagingService();
