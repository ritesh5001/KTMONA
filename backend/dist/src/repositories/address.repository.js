import { prisma } from '../config/db.js';
/**
 * Map a Prisma `user_addresses` row to the JSON shape exposed by the API.
 */
export function serializeAddress(row) {
    return {
        id: row.id,
        userId: row.user_id,
        label: row.label,
        addressLine1: row.address_line_1,
        addressLine2: row.address_line_2,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        country: row.country,
        isDefault: row.is_default,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}
// ---------------------------------------------------------------------------
// Repository — pure data access
// ---------------------------------------------------------------------------
export class AddressRepository {
    async findAllByUserId(userId) {
        return prisma.user_addresses.findMany({
            where: { user_id: userId },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
    }
    async findById(id) {
        return prisma.user_addresses.findUnique({ where: { id } });
    }
    async countByUserId(userId) {
        return prisma.user_addresses.count({ where: { user_id: userId } });
    }
    /**
     * Create with transactional default-flag handling.
     * If `isDefault` is true (or first address), unsets existing defaults first.
     */
    async createWithDefaultHandling(data) {
        return prisma.$transaction(async (tx) => {
            if (data.isDefault) {
                await tx.user_addresses.updateMany({
                    where: { user_id: data.userId, is_default: true },
                    data: { is_default: false, updated_at: new Date() },
                });
            }
            return tx.user_addresses.create({
                data: {
                    id: crypto.randomUUID(),
                    user_id: data.userId,
                    label: data.label ?? 'HOME',
                    address_line_1: data.addressLine1,
                    address_line_2: data.addressLine2 ?? null,
                    city: data.city,
                    state: data.state,
                    pincode: data.pincode,
                    country: 'India',
                    is_default: data.isDefault ?? false,
                    updated_at: new Date(),
                },
            });
        });
    }
    async update(id, data) {
        const mapped = { updated_at: new Date() };
        if (data.label !== undefined)
            mapped['label'] = data.label;
        if (data.addressLine1 !== undefined)
            mapped['address_line_1'] = data.addressLine1;
        if (data.addressLine2 !== undefined)
            mapped['address_line_2'] = data.addressLine2;
        if (data.city !== undefined)
            mapped['city'] = data.city;
        if (data.state !== undefined)
            mapped['state'] = data.state;
        if (data.pincode !== undefined)
            mapped['pincode'] = data.pincode;
        return prisma.user_addresses.update({ where: { id }, data: mapped });
    }
    /**
     * Delete inside a transaction; promote oldest remaining if default was deleted.
     */
    async deleteWithDefaultPromotion(userId, addressId, wasDefault) {
        return prisma.$transaction(async (tx) => {
            await tx.user_addresses.delete({ where: { id: addressId } });
            if (wasDefault) {
                const oldest = await tx.user_addresses.findFirst({
                    where: { user_id: userId },
                    orderBy: { created_at: 'asc' },
                });
                if (oldest) {
                    await tx.user_addresses.update({
                        where: { id: oldest.id },
                        data: { is_default: true, updated_at: new Date() },
                    });
                }
            }
        });
    }
    /**
     * Atomically unset all defaults, then set the specified address.
     */
    async setDefault(userId, addressId) {
        return prisma.$transaction(async (tx) => {
            await tx.user_addresses.updateMany({
                where: { user_id: userId, is_default: true },
                data: { is_default: false, updated_at: new Date() },
            });
            return tx.user_addresses.update({
                where: { id: addressId },
                data: { is_default: true, updated_at: new Date() },
            });
        });
    }
}
export const addressRepository = new AddressRepository();
//# sourceMappingURL=address.repository.js.map