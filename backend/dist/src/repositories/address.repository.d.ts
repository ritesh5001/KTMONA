import type { AddressLabel } from '@prisma/client';
export interface CreateAddressData {
    userId: string;
    label?: AddressLabel | undefined;
    addressLine1: string;
    addressLine2?: string | undefined;
    city: string;
    state: string;
    pincode: string;
    isDefault?: boolean | undefined;
}
export interface UpdateAddressData {
    label?: AddressLabel | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
}
export interface SerializedAddress {
    id: string;
    userId: string;
    label: AddressLabel;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}
/**
 * Map a Prisma `user_addresses` row to the JSON shape exposed by the API.
 */
export declare function serializeAddress(row: {
    id: string;
    user_id: string;
    label: AddressLabel;
    address_line_1: string;
    address_line_2: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
    is_default: boolean;
    created_at: Date;
    updated_at: Date;
}): SerializedAddress;
export declare class AddressRepository {
    findAllByUserId(userId: string): Promise<(import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        user_id: string;
        label: AddressLabel;
        address_line_1: string;
        address_line_2: string | null;
        city: string;
        state: string;
        pincode: string;
        country: string;
        is_default: boolean;
        created_at: Date;
        updated_at: Date;
    }, unknown> & {})[]>;
    findById(id: string): Promise<(import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        user_id: string;
        label: AddressLabel;
        address_line_1: string;
        address_line_2: string | null;
        city: string;
        state: string;
        pincode: string;
        country: string;
        is_default: boolean;
        created_at: Date;
        updated_at: Date;
    }, unknown> & {}) | null>;
    countByUserId(userId: string): Promise<number>;
    /**
     * Create with transactional default-flag handling.
     * If `isDefault` is true (or first address), unsets existing defaults first.
     */
    createWithDefaultHandling(data: CreateAddressData): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        user_id: string;
        label: AddressLabel;
        address_line_1: string;
        address_line_2: string | null;
        city: string;
        state: string;
        pincode: string;
        country: string;
        is_default: boolean;
        created_at: Date;
        updated_at: Date;
    }, unknown> & {}>;
    update(id: string, data: UpdateAddressData): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        user_id: string;
        label: AddressLabel;
        address_line_1: string;
        address_line_2: string | null;
        city: string;
        state: string;
        pincode: string;
        country: string;
        is_default: boolean;
        created_at: Date;
        updated_at: Date;
    }, unknown> & {}>;
    /**
     * Delete inside a transaction; promote oldest remaining if default was deleted.
     */
    deleteWithDefaultPromotion(userId: string, addressId: string, wasDefault: boolean): Promise<void>;
    /**
     * Atomically unset all defaults, then set the specified address.
     */
    setDefault(userId: string, addressId: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        user_id: string;
        label: AddressLabel;
        address_line_1: string;
        address_line_2: string | null;
        city: string;
        state: string;
        pincode: string;
        country: string;
        is_default: boolean;
        created_at: Date;
        updated_at: Date;
    }, unknown> & {}>;
}
export declare const addressRepository: AddressRepository;
//# sourceMappingURL=address.repository.d.ts.map