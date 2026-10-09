import type { ClaimType } from "@/services/seller-center";
import type { SupportTicketCategory } from "@/services/support";

/* Seller help center: topics → issues → guidance → "Raise a Ticket" form
   (same flow as the Meesho supplier panel's Support section). */

export type HelpField =
  | { key: string; label: string; type: "text" | "phone"; required?: boolean; placeholder?: string; hint?: string }
  | { key: string; label: string; type: "select"; required?: boolean; options: readonly string[] }
  | { key: string; label: string; type: "textarea"; required?: boolean; max?: number }
  | { key: string; label: string; type: "image" | "video" | "file"; required?: boolean; hint?: string };

export interface HelpIssue {
  id: string;
  title: string;
  /** Guidance shown before the seller raises a ticket. */
  body: string[];
  /** Extra fields beyond description / attachments / callback number. */
  fields?: HelpField[];
  /** Also files a seller claim of this type (returns / RTO / payment). */
  claimType?: ClaimType;
  responseDays?: number;
}

export interface HelpTopic {
  id: string;
  title: string;
  category: SupportTicketCategory;
  issues: HelpIssue[];
}

const ORDER = { key: "orderId", label: "Sub Order Number", type: "text", required: true, placeholder: "e.g. cmuzt…" } as const;
const AWB = { key: "awb", label: "AWB Number", type: "text", required: true } as const;
const PACKET_STATE = {
  key: "packetState",
  label: "State of the packet",
  type: "select",
  required: true,
  options: ["Packet intact", "Packet tampered / opened", "Packet damaged", "Packet not received"],
} as const;
const PACKET_ID = {
  key: "packetId",
  label: "Packet ID",
  type: "text",
  required: true,
  hint: "Correct Packet ID is mandatory for accurate claims resolution. Enter NA if your packet has none.",
} as const;
const PRODUCT_IMAGE = { key: "productImage", label: "Image of product received", type: "image", required: true } as const;
const WAYBILL = { key: "waybill", label: "Reverse Waybill", type: "image", required: true } as const;
const UNBOXING = {
  key: "video",
  label: "Unpacking Video",
  type: "video",
  required: true,
  hint: "Record in one take: all sides of the packet, the label (AWB, order ID) and the packet ID must be clearly visible.",
} as const;
const SKU = { key: "sku", label: "SKU / Style ID", type: "text", required: true } as const;

const VIDEO_GUIDE = [
  "Video guidelines (follow strictly for correct claim resolution):",
  "1. All sides of the package should be clearly visible in the video.",
  "2. The label must be clearly visible, showing the AWB number, order ID and package barcode.",
  "3. For barcoded shipments, the Packet ID must be clearly shown.",
  "4. The packaging must be opened and the product clearly shown, in one continuous take without edits or pauses.",
];

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "returns",
    title: "Returns/RTO & Exchange",
    category: "ORDER",
    issues: [
      {
        id: "wrong-return",
        title: "I have received wrong return",
        body: [
          "If you received a different product as a return, you can raise a claim within 7 days of return delivery. Attach images of the reverse waybill, the packet ID and the returned product along with the unpacking video.",
          ...VIDEO_GUIDE,
        ],
        fields: [ORDER, AWB, PACKET_STATE, PACKET_ID, PRODUCT_IMAGE, WAYBILL, UNBOXING],
        claimType: "WRONG_RETURN",
        responseDays: 7,
      },
      {
        id: "damaged-return",
        title: "I have received damaged return",
        body: ["If the returned product is damaged, raise a claim within 7 days of return delivery with the unpacking video and photos.", ...VIDEO_GUIDE],
        fields: [ORDER, AWB, PACKET_STATE, PACKET_ID, PRODUCT_IMAGE, WAYBILL, UNBOXING],
        claimType: "DAMAGED_RETURN",
        responseDays: 7,
      },
      {
        id: "return-not-received",
        title: "I have not received my Return/RTO shipment",
        body: [
          "Returns usually reach you within 7–10 days of pickup. If the tracking shows delivered but you have not received it, raise a ticket and we will ask the courier for proof of delivery.",
        ],
        fields: [ORDER, AWB],
        claimType: "RTO_NOT_RECEIVED",
      },
      {
        id: "missing-items",
        title: "Item/s are missing in my return",
        body: ["If the return packet came back with fewer items than were returned, raise a claim within 7 days with the unpacking video.", ...VIDEO_GUIDE],
        fields: [ORDER, AWB, PACKET_STATE, PACKET_ID, PRODUCT_IMAGE, UNBOXING],
        claimType: "MISSING_ITEM_IN_RETURN",
      },
      {
        id: "used-product",
        title: "I have received used product as return",
        body: ["Returns must come back unused with tags. If the product is used or washed, raise a claim with photos and the unpacking video.", ...VIDEO_GUIDE],
        fields: [ORDER, AWB, PACKET_ID, PRODUCT_IMAGE, UNBOXING],
        claimType: "DAMAGED_RETURN",
      },
      {
        id: "rto-damaged",
        title: "My RTO parcel came back damaged",
        body: ["If a parcel returned by the courier (RTO) is damaged or tampered, raise a claim within 7 days with the unpacking video.", ...VIDEO_GUIDE],
        fields: [ORDER, AWB, PACKET_STATE, PRODUCT_IMAGE, UNBOXING],
        claimType: "RTO_DAMAGED",
      },
      {
        id: "pod",
        title: "Return/RTO marked delivered but not received - Need Proof of Delivery",
        body: ["We will request the proof of delivery (signature / photo) from the courier partner and share it within 7 days."],
        fields: [ORDER, AWB],
        claimType: "RTO_NOT_RECEIVED",
      },
      {
        id: "false-attempt",
        title: "Return/RTO Delivery Issue - False Attempt by Logistic Partner",
        body: ["If the courier marked a delivery attempt without visiting your pickup address, tell us the date and time so we can escalate."],
        fields: [ORDER, AWB],
      },
      {
        id: "wdrp",
        title: "I want to stop using the Wrong/Defective Returns Feature",
        body: ["You can remove the WDRP discount any time from Pricing → Reduce RTOs & Returns by setting the WDRP discount to 0."],
      },
      {
        id: "compensation",
        title: "When will I receive my wrong return related compensation",
        body: ["Approved claim amounts are credited with your next weekly payout and show under Payments → Compensation & Recoveries."],
        claimType: "PAYMENT_ISSUE",
      },
      { id: "returns-other", title: "Other Returns/RTO and Exchange related issue", body: ["Describe the issue and attach any photos that help us understand it."] },
    ],
  },
  {
    id: "catalog",
    title: "Cataloging & Pricing",
    category: "PRODUCT",
    issues: [
      {
        id: "qc-error",
        title: "My catalog failed Quality Check (QC Error)",
        body: [
          "Open Catalog Uploads → QC Error to see the reason for each product. Fix the listed issue (images, title, attributes or price) and upload again.",
          "Images must not contain watermarks, text, prices, props or be blurred, stretched or inverted.",
        ],
        fields: [{ key: "fileId", label: "File ID", type: "text", required: true }],
      },
      {
        id: "qc-delay",
        title: "My catalog is in QC for more than 3 days",
        body: ["Most catalogs are reviewed within 72 hours. Books and branded products may take up to a week."],
        fields: [{ key: "fileId", label: "File ID", type: "text", required: true }],
      },
      {
        id: "price-increase",
        title: "I want to increase price / change variation details",
        body: ["Price cuts go live instantly from Pricing. Price increases and new variations are reviewed by the KTMONA team."],
        fields: [SKU, { key: "newPrice", label: "New price (₹)", type: "text", required: true }],
      },
      {
        id: "blocked",
        title: "My product is blocked / deactivated",
        body: ["Products are blocked for quality issues (high 1–2★ ratings), policy violations or suspected fake/branded listings. Check Quality and Inventory → Blocked for the reason."],
        fields: [SKU],
      },
      { id: "category-missing", title: "I can't find the category for my product", body: ["Tell us what you sell and we will add or map the right category."], fields: [{ key: "productType", label: "Product type", type: "text", required: true }] },
      { id: "catalog-other", title: "Other cataloging related issue", body: ["Describe the issue and attach screenshots if possible."] },
    ],
  },
  {
    id: "orders",
    title: "Orders & Delivery",
    category: "ORDER",
    issues: [
      { id: "label", title: "I am unable to download the shipping label", body: ["Labels are generated when you accept an order. If download fails, wait a few minutes and retry from Orders → Ready to Ship."], fields: [ORDER] },
      { id: "pickup", title: "Courier did not come for pickup", body: ["Pickups happen within 24 hours of manifest. If the courier missed it, raise a ticket with the AWB."], fields: [ORDER, AWB] },
      { id: "cancel", title: "I want to cancel an order", body: ["Cancel from Orders → Pending before dispatch. Frequent seller cancellations lower your account health and can lead to penalties."], fields: [ORDER] },
      { id: "sla", title: "Order marked late dispatch wrongly", body: ["If you handed the parcel over on time but it was marked late, share the pickup proof (manifest copy / courier receipt)."], fields: [ORDER, AWB, { key: "proof", label: "Pickup proof", type: "image", required: true }] },
      { id: "orders-other", title: "Other order related issue", body: ["Describe the issue and include the order number."] },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    category: "SETTLEMENT",
    issues: [
      { id: "not-received", title: "I have not received payment for a delivered order", body: ["Payments are released 7 days after delivery, every week, to your registered bank account."], fields: [ORDER], claimType: "PAYMENT_ISSUE" },
      { id: "less-amount", title: "I received less payment than expected", body: ["Check the order breakup in Payments: commission, platform fee, penalties and ad spend are deducted from the payout."], fields: [ORDER], claimType: "PAYMENT_ISSUE" },
      { id: "penalty", title: "I want to dispute a penalty", body: ["Share the order and why the penalty does not apply (e.g., courier delay)."], fields: [ORDER] },
      { id: "bank", title: "I want to change my bank account", body: ["Update bank details from Settings → Bank. Payouts are paused until the new account is verified."] },
      { id: "payments-other", title: "Other payment related issue", body: ["Describe the issue."] },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    category: "PRODUCT",
    issues: [
      { id: "stock-update", title: "Stock update is not reflecting", body: ["Stock changes go live within a minute. For bulk updates, use the latest file from Inventory → Bulk Stock Update."], fields: [SKU] },
      { id: "add-size", title: "I want to add a new size / variation", body: ["Use Inventory → More → Add New Variation. New variations are reviewed before going live."], fields: [SKU, { key: "sizes", label: "Sizes to add", type: "text", required: true }] },
      { id: "inventory-other", title: "Other inventory related issue", body: ["Describe the issue."] },
    ],
  },
  {
    id: "account",
    title: "Account",
    category: "ACCOUNT",
    issues: [
      { id: "gst", title: "I want to update GST / PAN details", body: ["Update business details from Settings → Business. GST changes are verified before they apply."] },
      { id: "address", title: "I want to change my pickup address", body: ["Update it from Settings → Pickup address. Orders already accepted keep the old address."] },
      { id: "store-name", title: "I want to change my store name", body: ["Change it from Settings → Store. Store names must be unique."] },
      { id: "warehouse", title: "Warehouse / fulfilment enquiry", body: ["Tell us your monthly order volume and preferred location; our team will call you back."], fields: [{ key: "city", label: "Preferred warehouse city", type: "text", required: true }] },
      { id: "account-other", title: "Other account related issue", body: ["Describe the issue."] },
    ],
  },
  {
    id: "promotions",
    title: "Advertisements & Promotions",
    category: "OTHER",
    issues: [
      { id: "sale", title: "I want to join a sale event", body: ["Open Sale Events, pick the event and choose the products and discount you want to offer."] },
      { id: "offer", title: "My offer / discount is not showing", body: ["Offers start at their scheduled time. Products in review or out of stock don't show the offer."], fields: [SKU] },
      { id: "promotions-other", title: "Other promotions related issue", body: ["Describe the issue."] },
    ],
  },
  {
    id: "others",
    title: "Others",
    category: "OTHER",
    issues: [{ id: "general", title: "I have a different question", body: ["Describe what you need help with and our team will reply within 2 working days."] }],
  },
];

export function findIssue(topicId: string | null, issueId: string | null) {
  const topic = HELP_TOPICS.find((t) => t.id === topicId) ?? null;
  const issue = topic?.issues.find((i) => i.id === issueId) ?? null;
  return { topic, issue };
}
