/**
 * Shiprocket shipping API (apiv2.shiprocket.in): create order → assign AWB →
 * label → pickup → manifest. Used when SHIPROCKET_EMAIL/PASSWORD are set;
 * otherwise sellers self-ship.
 */
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../errors/ApiError.js';
const BASE = 'https://apiv2.shiprocket.in/v1/external';
const log = logger.child({ module: 'shiprocket-shipping' });
let cachedToken = null;
export function isShiprocketShippingEnabled() {
    return Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD);
}
async function token() {
    if (cachedToken && cachedToken.expiresAt > Date.now())
        return cachedToken.value;
    const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    });
    const body = (await res.json().catch(() => ({})));
    if (!res.ok || !body.token) {
        throw new ApiError(502, `Shiprocket login failed: ${body.message ?? res.status}`);
    }
    // Tokens last 10 days; refresh well before that.
    cachedToken = { value: body.token, expiresAt: Date.now() + 8 * 86_400_000 };
    return body.token;
}
async function call(path, payload) {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({})));
    if (!res.ok) {
        log.warn({ path, status: res.status, message: body?.message }, 'Shiprocket call failed');
        throw new ApiError(502, `Shiprocket: ${body?.message ?? `request failed (${res.status})`}`);
    }
    return body;
}
/** Create the order, assign an AWB and fetch the label in one go. */
export async function bookShipment(input) {
    const created = await call('/orders/create/adhoc', {
        order_id: input.orderId,
        order_date: input.orderDate.toISOString().slice(0, 16).replace('T', ' '),
        pickup_location: input.pickupLocation,
        billing_customer_name: input.customer.name,
        billing_last_name: '',
        billing_address: input.customer.address,
        billing_address_2: input.customer.address2 ?? '',
        billing_city: input.customer.city,
        billing_pincode: input.customer.pincode,
        billing_state: input.customer.state ?? '',
        billing_country: 'India',
        billing_email: input.customer.email ?? '',
        billing_phone: input.customer.phone,
        shipping_is_billing: true,
        order_items: input.items.map((i) => ({
            name: i.name,
            sku: i.sku,
            units: i.units,
            selling_price: i.sellingPrice,
            hsn: i.hsn ?? '',
        })),
        payment_method: input.paymentMethod,
        sub_total: input.subTotal,
        length: input.dimensionsCm.length,
        breadth: input.dimensionsCm.breadth,
        height: input.dimensionsCm.height,
        weight: input.weightKg,
    });
    const shipmentId = String(created.shipment_id);
    const awb = await call('/courier/assign/awb', { shipment_id: shipmentId });
    const awbCode = awb.response?.data?.awb_code;
    if (!awbCode)
        throw new ApiError(502, 'Shiprocket did not assign an AWB. Check courier serviceability for this pincode.');
    let labelUrl = null;
    try {
        const label = await call('/courier/generate/label', { shipment_id: [shipmentId] });
        labelUrl = label.label_url ?? null;
    }
    catch (err) {
        log.warn({ err, shipmentId }, 'Label generation failed; KTMONA label will be used');
    }
    return {
        shiprocketOrderId: String(created.order_id),
        shipmentId,
        awb: awbCode,
        courier: awb.response?.data?.courier_name ?? 'Shiprocket',
        labelUrl,
    };
}
export async function requestPickup(shipmentIds) {
    await call('/courier/generate/pickup', { shipment_id: shipmentIds });
}
export async function generateManifest(shipmentIds) {
    const res = await call('/manifests/generate', { shipment_id: shipmentIds });
    return res.manifest_url ?? null;
}
/**
 * Register (or re-register) a seller's pickup address. Shiprocket only books
 * pickups from named locations, so the seller code is used as the name.
 */
export async function upsertPickupLocation(input) {
    try {
        await call('/settings/company/addpickup', {
            pickup_location: input.name,
            name: input.contactName,
            email: input.email,
            phone: input.phone,
            address: input.address,
            address_2: input.address2 ?? '',
            city: input.city,
            state: input.state,
            country: 'India',
            pin_code: input.pincode,
        });
    }
    catch (err) {
        // Re-adding an existing location name is rejected; that is fine.
        if (err instanceof ApiError && /already exists/i.test(err.message))
            return;
        throw err;
    }
}
//# sourceMappingURL=shiprocket-shipping.client.js.map