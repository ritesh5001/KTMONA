import PDFDocument from 'pdfkit';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { paymentLogger } from '../config/logger.js';
import { invoiceGeneratedTotal, invoiceDownloadTotal } from '../config/metrics.js';
/**
 * Platform constants
 */
const PLATFORM_NAME = 'Tatvivah';
const PLATFORM_GSTIN = '07AABCT1234F1ZH'; // Placeholder — replace with real GSTIN in env
/**
 * Generate a GST-compliant PDF invoice buffer for a given order.
 *
 * @param orderId - The order ID to generate an invoice for
 * @returns Buffer containing the PDF bytes
 */
export async function generateInvoicePDF(orderId) {
    const rawOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: true,
            payment: {
                select: {
                    id: true,
                    providerPaymentId: true,
                },
            },
        },
    });
    if (!rawOrder) {
        throw ApiError.notFound('Order not found');
    }
    if (!rawOrder.invoiceNumber) {
        throw ApiError.badRequest('Invoice not yet generated for this order');
    }
    if (rawOrder.status !== 'CONFIRMED' && rawOrder.status !== 'DELIVERED' && rawOrder.status !== 'SHIPPED') {
        throw ApiError.badRequest('Invoice is only available for confirmed/shipped/delivered orders');
    }
    // Fetch product + seller details for each item
    const productIds = [...new Set(rawOrder.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
            id: true,
            title: true,
            hsnCode: true,
            seller: {
                select: {
                    seller_profiles: {
                        select: {
                            store_name: true,
                            gstin: true,
                            state: true,
                        },
                    },
                },
            },
        },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    // Build typed order
    const order = {
        ...rawOrder,
        items: rawOrder.items.map((item) => ({
            ...item,
            product: productMap.get(item.productId) ?? null,
        })),
        payment: rawOrder.payment ?? null,
    };
    // Fetch buyer info
    const buyer = await prisma.user.findUnique({
        where: { id: order.userId },
        select: {
            email: true,
            phone: true,
            state: true,
            user_profiles: { select: { full_name: true } },
            user_addresses: {
                where: { is_default: true },
                select: {
                    address_line_1: true,
                    address_line_2: true,
                    city: true,
                    state: true,
                    pincode: true,
                },
                take: 1,
            },
        },
    });
    const buyerName = buyer?.user_profiles?.full_name ?? order.shippingName ?? 'Customer';
    const buyerAddr = buyer?.user_addresses?.[0];
    const buyerState = buyer?.state ?? buyerAddr?.state ?? '';
    const invoiceDate = order.invoiceIssuedAt
        ? formatDate(order.invoiceIssuedAt)
        : formatDate(order.createdAt);
    // ---- Build PDF ----
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const pdfReady = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
    // ======== HEADER ========
    doc.fontSize(20).font('Helvetica-Bold').text(PLATFORM_NAME, { align: 'left' });
    doc.fontSize(9).font('Helvetica').text(`GSTIN: ${PLATFORM_GSTIN}`);
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', { align: 'right' });
    doc.moveDown(0.3);
    // Invoice meta
    const metaY = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text(`Invoice No: ${order.invoiceNumber}`, 50, metaY);
    doc.text(`Invoice Date: ${invoiceDate}`, 50);
    doc.text(`Order ID: ${order.id}`, 50);
    if (order.payment?.providerPaymentId) {
        doc.text(`Payment ID: ${order.payment.providerPaymentId}`, 50);
    }
    doc.moveDown(1);
    // ======== BILL TO ========
    drawSectionHeader(doc, 'BILL TO');
    doc.fontSize(9).font('Helvetica');
    doc.text(buyerName);
    if (order.shippingAddressLine1)
        doc.text(order.shippingAddressLine1);
    if (order.shippingAddressLine2)
        doc.text(order.shippingAddressLine2);
    if (order.shippingCity)
        doc.text(order.shippingCity);
    if (buyerState)
        doc.text(`State: ${buyerState}`);
    doc.moveDown(1);
    // ======== SELLER DETAILS ========
    const sellers = new Map();
    for (const item of order.items) {
        const sp = item.product?.seller?.seller_profiles;
        if (sp && !sellers.has(sp.store_name)) {
            sellers.set(sp.store_name, {
                name: sp.store_name,
                gstin: sp.gstin ?? 'N/A',
                state: sp.state || 'N/A',
            });
        }
    }
    if (sellers.size > 0) {
        drawSectionHeader(doc, 'SELLER DETAILS');
        doc.fontSize(9).font('Helvetica');
        for (const seller of sellers.values()) {
            doc.text(`${seller.name}  |  GSTIN: ${seller.gstin}  |  State: ${seller.state}`);
        }
        doc.moveDown(1);
    }
    // ======== ITEM TABLE ========
    drawSectionHeader(doc, 'ITEMS');
    doc.moveDown(0.3);
    // Table header
    const tableTop = doc.y;
    const col = {
        product: 50,
        hsn: 180,
        qty: 225,
        unit: 260,
        taxable: 310,
        cgst: 365,
        sgst: 410,
        igst: 455,
        total: 500,
    };
    doc.fontSize(7).font('Helvetica-Bold');
    doc.text('Product', col.product, tableTop, { width: 125 });
    doc.text('HSN', col.hsn, tableTop, { width: 40 });
    doc.text('Qty', col.qty, tableTop, { width: 30, align: 'right' });
    doc.text('Unit ₹', col.unit, tableTop, { width: 45, align: 'right' });
    doc.text('Taxable ₹', col.taxable, tableTop, { width: 50, align: 'right' });
    doc.text('CGST ₹', col.cgst, tableTop, { width: 40, align: 'right' });
    doc.text('SGST ₹', col.sgst, tableTop, { width: 40, align: 'right' });
    doc.text('IGST ₹', col.igst, tableTop, { width: 40, align: 'right' });
    doc.text('Total ₹', col.total, tableTop, { width: 50, align: 'right' });
    doc.moveTo(50, doc.y + 3).lineTo(550, doc.y + 3).stroke();
    doc.moveDown(0.5);
    // Table rows
    doc.font('Helvetica').fontSize(7);
    for (const item of order.items) {
        const y = doc.y;
        if (y > 720) {
            doc.addPage();
        }
        const rowY = doc.y;
        const title = item.product?.title ?? 'Product';
        const hsn = item.product?.hsnCode ?? '—';
        doc.text(title.slice(0, 30), col.product, rowY, { width: 125 });
        doc.text(hsn, col.hsn, rowY, { width: 40 });
        doc.text(String(item.quantity), col.qty, rowY, { width: 30, align: 'right' });
        doc.text(fmt(item.priceSnapshot), col.unit, rowY, { width: 45, align: 'right' });
        doc.text(fmt(item.taxableAmount), col.taxable, rowY, { width: 50, align: 'right' });
        doc.text(fmt(item.cgstAmount), col.cgst, rowY, { width: 40, align: 'right' });
        doc.text(fmt(item.sgstAmount), col.sgst, rowY, { width: 40, align: 'right' });
        doc.text(fmt(item.igstAmount), col.igst, rowY, { width: 40, align: 'right' });
        doc.text(fmt(item.totalAmount), col.total, rowY, { width: 50, align: 'right' });
        doc.moveDown(0.7);
    }
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);
    // ======== TOTALS ========
    const shippingAmount = Math.max(order.grandTotal - order.subTotalAmount - order.totalTaxAmount, 0);
    const totalsX = 380;
    doc.fontSize(9).font('Helvetica');
    drawTotalLine(doc, 'Subtotal', fmt(order.subTotalAmount), totalsX);
    drawTotalLine(doc, 'Total Tax (GST)', fmt(order.totalTaxAmount), totalsX);
    drawTotalLine(doc, 'Shipping', fmt(shippingAmount), totalsX);
    doc.moveDown(0.3);
    doc.moveTo(totalsX, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11);
    drawTotalLine(doc, 'Grand Total', `₹${fmt(order.grandTotal)}`, totalsX);
    doc.moveDown(2);
    // ======== FOOTER ========
    doc.fontSize(8).font('Helvetica').fillColor('#666666');
    doc.text('Tax is calculated as per GST Act, India.', 50, doc.y, { align: 'center' });
    doc.text('This is a system-generated invoice.', { align: 'center' });
    doc.end();
    const buffer = await pdfReady;
    invoiceGeneratedTotal.inc();
    paymentLogger.info({
        event: 'invoice_generated',
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
    }, `Invoice generated: ${order.invoiceNumber}`);
    return buffer;
}
/**
 * Increment download counter (called by controller)
 */
export function recordInvoiceDownload() {
    invoiceDownloadTotal.inc();
}
// ---- Helpers ----
function fmt(n) {
    return n.toFixed(2);
}
function formatDate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}
function drawSectionHeader(doc, title) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text(title);
    doc.moveTo(50, doc.y + 2).lineTo(550, doc.y + 2).strokeColor('#CCCCCC').stroke();
    doc.moveDown(0.4);
    doc.fillColor('#000000').strokeColor('#000000');
}
function drawTotalLine(doc, label, value, x) {
    const y = doc.y;
    doc.text(label, x, y, { width: 100 });
    doc.text(value, x + 100, y, { width: 70, align: 'right' });
    doc.moveDown(0.4);
}
//# sourceMappingURL=invoice.service.js.map