/**
 * KTMONA shipping labels (4x6 in) and pickup manifests (A4), as PDF buffers.
 */

import PDFDocument from 'pdfkit';

// ── Code 128 (set B) barcode ────────────────────────────────────────────────
// Bar/space widths for symbol values 0..106. Enough for AWBs and order IDs.
const CODE128 = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112',
];

function code128Widths(text: string): number[] {
    const clean = text.replace(/[^\x20-\x7e]/g, '');
    const values = [104, ...[...clean].map((c) => c.charCodeAt(0) - 32)];
    const checksum = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
    return [...values, checksum, 106].flatMap((v) => [...(CODE128[v] ?? '')].map(Number));
}

function drawBarcode(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, height: number) {
    const widths = code128Widths(text);
    const modules = widths.reduce((a, b) => a + b, 0);
    const unit = width / modules;
    let cursor = x;
    widths.forEach((w, i) => {
        if (i % 2 === 0) doc.rect(cursor, y, w * unit, height).fill('#000');
        cursor += w * unit;
    });
    doc.fillColor('#000').fontSize(8).text(text, x, y + height + 2, { width, align: 'center' });
}

// ── Label ───────────────────────────────────────────────────────────────────

export interface LabelData {
    orderId: string;
    orderDate: Date;
    awb: string | null;
    courier: string;
    paymentMode: 'PREPAID' | 'COD';
    codAmount: number;
    shipTo: { name: string; phone: string; line1: string; line2?: string | null; city: string; pincode: string };
    returnTo: { name: string; phone: string; line1: string; line2?: string | null; city: string; state?: string | null; pincode: string };
    items: { title: string; sku: string; size: string; color?: string | null; quantity: number }[];
    gstin?: string | null;
}

const LABEL_W = 288; // 4in
const LABEL_H = 432; // 6in

function drawLabel(doc: PDFKit.PDFDocument, d: LabelData) {
    const m = 12;
    const w = LABEL_W - m * 2;
    doc.lineWidth(1).strokeColor('#000');
    doc.rect(m / 2, m / 2, LABEL_W - m, LABEL_H - m).stroke();

    // Header
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0C1B42').text('KTMONA', m, m + 2);
    doc.font('Helvetica').fontSize(7).fillColor('#000').text('Trust Every Click', m, m + 20);
    doc.font('Helvetica-Bold').fontSize(11)
        .text(d.paymentMode === 'COD' ? `COD  Rs. ${d.codAmount.toFixed(0)}` : 'PREPAID', m, m + 4, { width: w, align: 'right' });
    doc.font('Helvetica').fontSize(8).text(d.courier, m, m + 20, { width: w, align: 'right' });
    doc.moveTo(m / 2, 44).lineTo(LABEL_W - m / 2, 44).stroke();

    // Ship to
    let y = 50;
    doc.font('Helvetica-Bold').fontSize(8).text('DELIVER TO', m, y);
    y += 11;
    doc.font('Helvetica-Bold').fontSize(11).text(d.shipTo.name, m, y, { width: w });
    y = doc.y + 1;
    doc.font('Helvetica').fontSize(9)
        .text([d.shipTo.line1, d.shipTo.line2].filter(Boolean).join(', '), m, y, { width: w })
        .text(`${d.shipTo.city} - ${d.shipTo.pincode}`, { width: w })
        .text(`Phone: ${d.shipTo.phone}`, { width: w });
    y = doc.y + 6;

    // Barcode
    const code = d.awb ?? d.orderId;
    doc.moveTo(m / 2, y).lineTo(LABEL_W - m / 2, y).stroke();
    drawBarcode(doc, code, m + 10, y + 8, w - 20, 46);
    doc.font('Helvetica').fontSize(8).text(d.awb ? `AWB: ${d.awb}` : 'AWB: to be assigned by courier', m, y + 68, { width: w, align: 'center' });
    y += 82;

    // Order + items
    doc.moveTo(m / 2, y).lineTo(LABEL_W - m / 2, y).stroke();
    y += 5;
    doc.font('Helvetica-Bold').fontSize(8).text(`Order: ${d.orderId}`, m, y);
    doc.font('Helvetica').text(d.orderDate.toLocaleDateString('en-IN'), m, y, { width: w, align: 'right' });
    y += 12;
    for (const item of d.items.slice(0, 5)) {
        const variant = [item.size !== 'Default' ? item.size : null, item.color].filter(Boolean).join(' / ');
        doc.font('Helvetica').fontSize(8).text(`${item.quantity} × ${item.title}${variant ? ` (${variant})` : ''}`, m, y, { width: w - 60, ellipsis: true, height: 10 });
        doc.text(item.sku, m, y, { width: w, align: 'right' });
        y += 11;
    }
    if (d.items.length > 5) {
        doc.text(`+ ${d.items.length - 5} more item(s)`, m, y);
        y += 11;
    }

    // Return address
    const ry = LABEL_H - 78;
    doc.moveTo(m / 2, ry).lineTo(LABEL_W - m / 2, ry).stroke();
    doc.font('Helvetica-Bold').fontSize(7).text('IF UNDELIVERED, RETURN TO', m, ry + 5);
    doc.font('Helvetica').fontSize(7)
        .text(d.returnTo.name, m, ry + 15, { width: w })
        .text([d.returnTo.line1, d.returnTo.line2].filter(Boolean).join(', '), { width: w })
        .text(`${d.returnTo.city}${d.returnTo.state ? `, ${d.returnTo.state}` : ''} - ${d.returnTo.pincode}  ·  ${d.returnTo.phone}`, { width: w });
    if (d.gstin) doc.text(`GSTIN: ${d.gstin}`, { width: w });
}

function render(build: (doc: PDFKit.PDFDocument) => void, options: PDFKit.PDFDocumentOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ ...options, autoFirstPage: false });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        build(doc);
        doc.end();
    });
}

/** One 4x6 label per shipment, all in a single PDF. */
export function renderLabels(labels: LabelData[]): Promise<Buffer> {
    return render((doc) => {
        for (const label of labels) {
            doc.addPage({ size: [LABEL_W, LABEL_H], margin: 0 });
            drawLabel(doc, label);
        }
    }, { size: [LABEL_W, LABEL_H], margin: 0 });
}

// ── Manifest ────────────────────────────────────────────────────────────────

export interface ManifestData {
    manifestId: string;
    createdAt: Date;
    seller: { storeName: string; sellerCode: string; address: string };
    rows: { orderId: string; awb: string | null; courier: string; items: number; paymentMode: string }[];
}

export function renderManifest(data: ManifestData): Promise<Buffer> {
    return render((doc) => {
        doc.addPage({ size: 'A4', margin: 40 });
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#0C1B42').text('KTMONA · Pickup Manifest');
        doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor('#000')
            .text(`Manifest: ${data.manifestId}`)
            .text(`Generated: ${data.createdAt.toLocaleString('en-IN')}`)
            .text(`Seller: ${data.seller.storeName} (${data.seller.sellerCode})`)
            .text(`Pickup address: ${data.seller.address}`);
        doc.moveDown();

        const cols = [40, 70, 230, 360, 440, 500];
        const header = ['#', 'Order ID', 'AWB', 'Courier', 'Items', 'Mode'];
        let y = doc.y;
        doc.font('Helvetica-Bold').fontSize(9);
        header.forEach((h, i) => doc.text(h, cols[i]!, y));
        y += 14;
        doc.moveTo(40, y - 3).lineTo(555, y - 3).stroke();
        doc.font('Helvetica').fontSize(9);
        data.rows.forEach((r, idx) => {
            if (y > 760) {
                doc.addPage({ size: 'A4', margin: 40 });
                y = 50;
            }
            [String(idx + 1), r.orderId, r.awb ?? '—', r.courier, String(r.items), r.paymentMode].forEach((v, i) =>
                doc.text(v, cols[i]!, y, { width: (cols[i + 1] ?? 555) - cols[i]! - 4, ellipsis: true, height: 12 })
            );
            y += 16;
        });

        y += 30;
        doc.font('Helvetica').fontSize(10)
            .text(`Total shipments: ${data.rows.length}`, 40, y)
            .text('Seller signature: ______________________', 40, y + 40)
            .text('Courier executive name & signature: ______________________', 300, y + 40);
    }, { size: 'A4', margin: 40 });
}
