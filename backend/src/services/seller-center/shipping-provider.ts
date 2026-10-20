/**
 * Which courier account books seller shipments. ShipMaxx wins when both are
 * configured, so switching over is just setting its env vars; shipments
 * already booked keep their own fulfillment_mode either way.
 */

import { prisma } from '../../config/db.js';
import { isShipmaxxShippingEnabled } from './shipmaxx.client.js';
import { isShiprocketShippingEnabled } from './shiprocket-shipping.client.js';

export type CourierProvider = 'SHIPMAXX' | 'SHIPROCKET';

export function activeCourierProvider(): CourierProvider | null {
    if (isShipmaxxShippingEnabled()) return 'SHIPMAXX';
    if (isShiprocketShippingEnabled()) return 'SHIPROCKET';
    return null;
}

/**
 * Delivery state for an order. Orders store no state, so use the buyer's saved
 * address with the same pincode, then the pincode's postal circle.
 */
export async function deliveryState(userId: string, pincode: string): Promise<string> {
    const pin = pincode.trim();
    const saved = await prisma.user_addresses.findFirst({
        where: { user_id: userId, pincode: pin, NOT: { state: '' } },
        select: { state: true },
    });
    return saved?.state ?? stateFromPincode(pin) ?? '';
}

/** First-digits → state, from India Post's postal circles. */
const PIN3: Record<string, string> = {
    '160': 'Chandigarh', '246': 'Uttarakhand', '247': 'Uttarakhand', '248': 'Uttarakhand', '249': 'Uttarakhand',
    '262': 'Uttarakhand', '263': 'Uttarakhand', '403': 'Goa', '605': 'Puducherry',
    '737': 'Sikkim', '744': 'Andaman and Nicobar Islands', '790': 'Arunachal Pradesh', '791': 'Arunachal Pradesh',
    '792': 'Arunachal Pradesh', '793': 'Meghalaya', '794': 'Meghalaya', '795': 'Manipur', '796': 'Mizoram',
    '797': 'Nagaland', '798': 'Nagaland', '799': 'Tripura', '814': 'Jharkhand', '815': 'Jharkhand', '816': 'Jharkhand',
};
const PIN2: Record<string, string> = {
    '11': 'Delhi', '12': 'Haryana', '13': 'Haryana', '14': 'Punjab', '15': 'Punjab', '16': 'Punjab',
    '17': 'Himachal Pradesh', '18': 'Jammu and Kashmir', '19': 'Jammu and Kashmir',
    '20': 'Uttar Pradesh', '21': 'Uttar Pradesh', '22': 'Uttar Pradesh', '23': 'Uttar Pradesh', '24': 'Uttar Pradesh',
    '25': 'Uttar Pradesh', '26': 'Uttar Pradesh', '27': 'Uttar Pradesh', '28': 'Uttar Pradesh',
    '30': 'Rajasthan', '31': 'Rajasthan', '32': 'Rajasthan', '33': 'Rajasthan', '34': 'Rajasthan',
    '36': 'Gujarat', '37': 'Gujarat', '38': 'Gujarat', '39': 'Gujarat',
    '40': 'Maharashtra', '41': 'Maharashtra', '42': 'Maharashtra', '43': 'Maharashtra', '44': 'Maharashtra',
    '45': 'Madhya Pradesh', '46': 'Madhya Pradesh', '47': 'Madhya Pradesh', '48': 'Madhya Pradesh', '49': 'Chhattisgarh',
    '50': 'Telangana', '51': 'Andhra Pradesh', '52': 'Andhra Pradesh', '53': 'Andhra Pradesh',
    '56': 'Karnataka', '57': 'Karnataka', '58': 'Karnataka', '59': 'Karnataka',
    '60': 'Tamil Nadu', '61': 'Tamil Nadu', '62': 'Tamil Nadu', '63': 'Tamil Nadu', '64': 'Tamil Nadu',
    '67': 'Kerala', '68': 'Kerala', '69': 'Kerala',
    '70': 'West Bengal', '71': 'West Bengal', '72': 'West Bengal', '73': 'West Bengal', '74': 'West Bengal',
    '75': 'Odisha', '76': 'Odisha', '77': 'Odisha', '78': 'Assam',
    '80': 'Bihar', '81': 'Bihar', '82': 'Jharkhand', '83': 'Jharkhand', '84': 'Bihar', '85': 'Bihar',
};

export function stateFromPincode(pincode: string): string | null {
    if (!/^[1-9][0-9]{5}$/.test(pincode)) return null;
    return PIN3[pincode.slice(0, 3)] ?? PIN2[pincode.slice(0, 2)] ?? null;
}
