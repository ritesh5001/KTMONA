/**
 * Shipment Repository
 * Database operations for shipping and fulfillment
 */

import { prisma } from '../config/db.js';
import {
    ShipmentStatus,
    shipments,
    Prisma
} from '@prisma/client';
import { CreateShipmentInput } from '../types/shipment.types.js';

export class ShipmentRepository {

    /**
     * Create a new shipment and initial event
     */
    async create(
        data: CreateShipmentInput,
        orderId: string,
        sellerId: string
    ): Promise<shipments> {
        return prisma.shipments.create({
            data: {
                order_id: orderId,
                seller_id: sellerId,
                carrier: data.carrier,
                tracking_number: data.trackingNumber,
                status: 'CREATED',
                updated_at: new Date(),
                shipment_events: {
                    create: {
                        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        status: 'CREATED',
                        note: 'Shipment created'
                    }
                },
                // Using cuid logic for ID since schema doesn't seem to have default(cuid()) on ID but it's string
                id: `shp_${Date.now()}_${Math.random().toString(36).substring(7)}`
            },
            include: {
                shipment_events: true
            }
        });
    }

    /**
     * Update shipment status and add event
     */
    async updateStatus(
        shipmentId: string,
        status: ShipmentStatus,
        note?: string
    ): Promise<shipments> {
        const updateData: Prisma.shipmentsUpdateInput = {
            status,
            updated_at: new Date()
        };

        if (status === 'SHIPPED') {
            updateData.shipped_at = new Date();
        } else if (status === 'DELIVERED') {
            updateData.delivered_at = new Date();
        }

        return prisma.shipments.update({
            where: { id: shipmentId },
            data: {
                ...updateData,
                shipment_events: {
                    create: {
                        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        status,
                        note: note || `Shipment marked as ${status}`
                    }
                }
            },
            include: {
                shipment_events: true
            }
        });
    }

    /**
     * Find shipment by ID
     */
    async findById(id: string): Promise<shipments | null> {
        return prisma.shipments.findUnique({
            where: { id },
            include: {
                shipment_events: {
                    orderBy: { created_at: 'desc' }
                }
            }
        });
    }

    /**
     * Find shipments for an order (for tracking)
     */
    async findByOrderId(orderId: string): Promise<shipments[]> {
        return prisma.shipments.findMany({
            where: { order_id: orderId },
            include: {
                shipment_events: {
                    orderBy: { created_at: 'desc' }
                }
            },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * Find shipments for a seller
     */
    async findBySellerId(sellerId: string): Promise<any[]> {
        return prisma.shipments.findMany({
            where: { seller_id: sellerId },
            include: {
                orders: {
                    select: {
                        id: true,
                        createdAt: true,
                        totalAmount: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * Check if seller already has shipment for order
     */
    async existsForSellerAndOrder(sellerId: string, orderId: string): Promise<boolean> {
        const count = await prisma.shipments.count({
            where: {
                seller_id: sellerId,
                order_id: orderId
            }
        });
        return count > 0;
    }

    /**
     * Count shipments for an order
     */
    async countByOrder(orderId: string): Promise<number> {
        return prisma.shipments.count({
            where: { order_id: orderId }
        });
    }

    /**
     * Count distinct sellers in an order (to compare with shipments count)
     * Using OrderItem to get distinct sellerIds
     */
    async countDistinctSellersInOrder(orderId: string): Promise<number> {
        const items = await prisma.orderItem.findMany({
            where: { orderId },
            select: { sellerId: true },
            distinct: ['sellerId']
        });
        return items.length;
    }

    /**
     * Check if all shipments for an order are in specific status (or beyond)
     * e.g. for SHIPPED: check if all have SHIPPED or DELIVERED status
     */
    async areAllShipmentsAtLeast(orderId: string, status: ShipmentStatus): Promise<boolean> {
        const shipments = await this.findByOrderId(orderId);

        // If no shipments yet but order exists, obviously false
        if (shipments.length === 0) return false;

        // Check against required seller count first
        const requiredSellers = await this.countDistinctSellersInOrder(orderId);
        if (shipments.length < requiredSellers) return false;

        return shipments.every(s => {
            if (status === 'SHIPPED') {
                return s.status === 'SHIPPED' || s.status === 'DELIVERED';
            }
            if (status === 'DELIVERED') {
                return s.status === 'DELIVERED';
            }
            return false;
        });
    }
}

export const shipmentRepository = new ShipmentRepository();
