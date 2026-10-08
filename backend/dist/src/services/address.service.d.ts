import { type CreateAddressData, type UpdateAddressData, type SerializedAddress, type AddressRepository } from '../repositories/address.repository.js';
export declare class AddressService {
    private repo;
    constructor(repo: AddressRepository);
    list(userId: string): Promise<SerializedAddress[]>;
    create(userId: string, input: Omit<CreateAddressData, 'userId'>): Promise<SerializedAddress>;
    update(userId: string, addressId: string, input: UpdateAddressData): Promise<SerializedAddress>;
    delete(userId: string, addressId: string): Promise<void>;
    setDefault(userId: string, addressId: string): Promise<SerializedAddress>;
}
export declare const addressService: AddressService;
//# sourceMappingURL=address.service.d.ts.map