import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';

/** Shown in the seller panel; it links to Settings → KYC. */
export const KYC_REQUIRED_MESSAGE =
    'Complete your KYC to start listing products. Submit your KYC details in Settings; you can add products once KTMONA has verified them.';

/** True when the seller's KYC has been verified by an admin. */
export async function isSellerKycVerified(sellerId: string): Promise<boolean> {
    const profile = await prisma.seller_profiles.findUnique({ where: { user_id: sellerId }, select: { kyc_status: true } });
    return profile?.kyc_status === 'VERIFIED';
}

/**
 * Sellers may not list products until their KYC is verified. Enforced in
 * productService.createProduct, which every listing path goes through
 * (single catalog, bulk upload, seller products API).
 */
export async function assertSellerKycVerified(sellerId: string): Promise<void> {
    if (!(await isSellerKycVerified(sellerId))) {
        throw ApiError.forbidden(KYC_REQUIRED_MESSAGE);
    }
}
