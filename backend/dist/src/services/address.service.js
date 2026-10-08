import { ApiError } from '../errors/ApiError.js';
import { addressRepository, serializeAddress, } from '../repositories/address.repository.js';
import { CACHE_KEYS, getFromCache, invalidateCache, setCache } from '../utils/cache.util.js';
const MAX_ADDRESSES_PER_USER = 10;
const ADDRESS_CACHE_TTL_SECONDS = 60;
export class AddressService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    // -----------------------------------------------------------------------
    // List
    // -----------------------------------------------------------------------
    async list(userId) {
        const cacheKey = CACHE_KEYS.USER_ADDRESSES(userId);
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const rows = await this.repo.findAllByUserId(userId);
        const addresses = rows.map(serializeAddress);
        await setCache(cacheKey, addresses, ADDRESS_CACHE_TTL_SECONDS);
        return addresses;
    }
    // -----------------------------------------------------------------------
    // Create
    // -----------------------------------------------------------------------
    async create(userId, input) {
        const count = await this.repo.countByUserId(userId);
        if (count >= MAX_ADDRESSES_PER_USER) {
            throw ApiError.badRequest(`Maximum of ${MAX_ADDRESSES_PER_USER} addresses allowed`);
        }
        // First address for a user is always default
        const isDefault = count === 0 ? true : (input.isDefault ?? false);
        const row = await this.repo.createWithDefaultHandling({ ...input, userId, isDefault });
        await invalidateCache(CACHE_KEYS.USER_ADDRESSES(userId));
        return serializeAddress(row);
    }
    // -----------------------------------------------------------------------
    // Update
    // -----------------------------------------------------------------------
    async update(userId, addressId, input) {
        const existing = await this.repo.findById(addressId);
        if (!existing)
            throw ApiError.notFound('Address not found');
        if (existing.user_id !== userId)
            throw ApiError.forbidden('Access denied');
        const row = await this.repo.update(addressId, input);
        await invalidateCache(CACHE_KEYS.USER_ADDRESSES(userId));
        return serializeAddress(row);
    }
    // -----------------------------------------------------------------------
    // Delete
    // -----------------------------------------------------------------------
    async delete(userId, addressId) {
        const existing = await this.repo.findById(addressId);
        if (!existing)
            throw ApiError.notFound('Address not found');
        if (existing.user_id !== userId)
            throw ApiError.forbidden('Access denied');
        await this.repo.deleteWithDefaultPromotion(userId, addressId, existing.is_default);
        await invalidateCache(CACHE_KEYS.USER_ADDRESSES(userId));
    }
    // -----------------------------------------------------------------------
    // Set default
    // -----------------------------------------------------------------------
    async setDefault(userId, addressId) {
        const existing = await this.repo.findById(addressId);
        if (!existing)
            throw ApiError.notFound('Address not found');
        if (existing.user_id !== userId)
            throw ApiError.forbidden('Access denied');
        if (existing.is_default) {
            return serializeAddress(existing);
        }
        const row = await this.repo.setDefault(userId, addressId);
        await invalidateCache(CACHE_KEYS.USER_ADDRESSES(userId));
        return serializeAddress(row);
    }
}
export const addressService = new AddressService(addressRepository);
//# sourceMappingURL=address.service.js.map