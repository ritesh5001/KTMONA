/**
 * Seller settings: store profile, business/GST details, pickup address,
 * bank account for payouts and holiday mode.
 */
import { BusinessType } from '@prisma/client';
declare class SellerSettingsService {
    get(sellerId: string): Promise<{
        sellerCode: string;
        account: {
            email: string | null;
            phone: string | null;
            whatsapp: string | null;
            status: import(".prisma/client").UserStatus;
            joinedAt: Date;
        };
        store: {
            name: string;
            slug: string;
            description: string | null;
            logo: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        business: {
            businessType: BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            kycStatus: import(".prisma/client").KycStatus;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
        }[];
        shipping: {
            mode: string;
        };
    }>;
    storeNameAvailable(name: string, sellerId?: string): Promise<{
        name: string;
        slug: string;
        available: boolean;
    }>;
    /** Create the profile on first save; later saves update it. */
    private ensureProfile;
    updateStore(sellerId: string, input: {
        name: string;
        description?: string | null | undefined;
        logo?: string | null | undefined;
        supportEmail?: string | null | undefined;
        supportPhone?: string | null | undefined;
    }): Promise<{
        sellerCode: string;
        account: {
            email: string | null;
            phone: string | null;
            whatsapp: string | null;
            status: import(".prisma/client").UserStatus;
            joinedAt: Date;
        };
        store: {
            name: string;
            slug: string;
            description: string | null;
            logo: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        business: {
            businessType: BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            kycStatus: import(".prisma/client").KycStatus;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
        }[];
        shipping: {
            mode: string;
        };
    }>;
    updateBusiness(sellerId: string, input: {
        businessType: BusinessType;
        gstRegistered: boolean;
        gstin?: string | null | undefined;
        enrolmentId?: string | null | undefined;
        pan: string;
        state: string;
    }): Promise<{
        sellerCode: string;
        account: {
            email: string | null;
            phone: string | null;
            whatsapp: string | null;
            status: import(".prisma/client").UserStatus;
            joinedAt: Date;
        };
        store: {
            name: string;
            slug: string;
            description: string | null;
            logo: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        business: {
            businessType: BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            kycStatus: import(".prisma/client").KycStatus;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
        }[];
        shipping: {
            mode: string;
        };
    }>;
    updatePickup(sellerId: string, input: {
        contactName: string;
        phone: string;
        line1: string;
        line2?: string | null | undefined;
        city: string;
        state: string;
        pincode: string;
    }): Promise<{
        sellerCode: string;
        account: {
            email: string | null;
            phone: string | null;
            whatsapp: string | null;
            status: import(".prisma/client").UserStatus;
            joinedAt: Date;
        };
        store: {
            name: string;
            slug: string;
            description: string | null;
            logo: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        business: {
            businessType: BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            kycStatus: import(".prisma/client").KycStatus;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
        }[];
        shipping: {
            mode: string;
        };
    }>;
    upsertBank(sellerId: string, input: {
        bankName: string;
        holderName: string;
        accountNumber: string;
        ifsc: string;
    }): Promise<{
        sellerCode: string;
        account: {
            email: string | null;
            phone: string | null;
            whatsapp: string | null;
            status: import(".prisma/client").UserStatus;
            joinedAt: Date;
        };
        store: {
            name: string;
            slug: string;
            description: string | null;
            logo: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        business: {
            businessType: BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            kycStatus: import(".prisma/client").KycStatus;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
        }[];
        shipping: {
            mode: string;
        };
    }>;
    setVacation(sellerId: string, on: boolean): Promise<{
        sellerCode: string;
        account: {
            email: string | null;
            phone: string | null;
            whatsapp: string | null;
            status: import(".prisma/client").UserStatus;
            joinedAt: Date;
        };
        store: {
            name: string;
            slug: string;
            description: string | null;
            logo: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        business: {
            businessType: BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            kycStatus: import(".prisma/client").KycStatus;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
        }[];
        shipping: {
            mode: string;
        };
    }>;
}
export declare const sellerSettingsService: SellerSettingsService;
export {};
//# sourceMappingURL=settings.service.d.ts.map