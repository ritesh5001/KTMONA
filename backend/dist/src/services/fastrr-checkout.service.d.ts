/**
 * Minting a Shiprocket Checkout (Fastrr) session.
 *
 * This is the first half of the Fastrr flow. It validates the buyer's selection
 * exactly as the native checkout would, asks Fastrr for an access token, and
 * records a FastrrCheckoutSession so their webhook has something to land on.
 *
 * What it deliberately does *not* do is touch inventory. Fastrr owns the buyer
 * for the next few minutes and most sessions are abandoned; reserving stock here
 * would hold real units hostage to every window that was opened and closed. The
 * order — and the reservation — is created when Fastrr confirms payment, in
 * fastrr-order.service.ts. The cost of that choice is a genuine oversell window
 * on the last unit in stock, which is why `validateSelection` re-checks stock at
 * mint time and the order materialiser fails loudly rather than going negative.
 *
 * Pricing: every line is sent with `catalog_data`, so our price is authoritative
 * even if the catalog feed has not reached Fastrr yet. A *Tatvivah* coupon the
 * buyer applied before launching the overlay is passed as a fixed `cart_discount`
 * — which, per Fastrr's contract, disables their own coupon engine for that
 * session. With no local coupon we send no discount at all and the buyer can use
 * Fastrr's coupons (including the TESTA test code) inside the overlay.
 */
export interface FastrrTokenRequest {
    userId: string;
    /** Buy-now: restrict to these variants. Omitted means the whole cart. */
    variantIds?: string[] | undefined;
    /** A Tatvivah coupon the buyer applied before launching the overlay. */
    couponCode?: string | undefined;
    /** True when the overlay is being opened inside the Expo app's WebView. */
    mobileApp?: boolean | undefined;
}
export interface FastrrTokenResponse {
    token: string;
    expiresAt: string;
    fastrrOrderId: string;
    sessionId: string;
    scriptUrl: string;
    styleUrl: string;
    /** Where Fastrr will return the buyer, minus the oid/ost it appends. */
    redirectUrl: string;
    /** Native checkout, used if the Fastrr bundle fails to load. */
    fallbackUrl: string;
}
export declare class FastrrCheckoutService {
    /**
     * Validate the selection, mint a Fastrr token, and persist the session.
     */
    createSession(request: FastrrTokenRequest): Promise<FastrrTokenResponse>;
    /**
     * The same checks the native checkout runs before reserving stock. Kept
     * separate from a reservation so an abandoned overlay costs nothing, at the
     * price of a stock re-check being advisory rather than binding.
     */
    private validateSelection;
    /**
     * Where Fastrr returns the buyer. It appends `?oid=<order id>&ost=<status>`,
     * so anything we add has to survive alongside those.
     *
     * The same path serves web and app: the Expo WebView recognises the buyer is
     * done by matching this prefix, so it must not diverge from the web route.
     */
    private buildRedirectUrl;
    /**
     * Fastrr redirects the buyer's own browser here after taking their money, so
     * a host only a developer can reach is the worst possible value: the charge
     * succeeds and the buyer lands on a dead page. Same reasoning as the PhonePe
     * redirect base in payment.service.ts.
     */
    private frontendBaseUrl;
}
export declare const fastrrCheckoutService: FastrrCheckoutService;
//# sourceMappingURL=fastrr-checkout.service.d.ts.map