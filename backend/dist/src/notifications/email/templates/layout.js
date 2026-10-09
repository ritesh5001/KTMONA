export function escapeHtml(value) {
    const input = String(value ?? '');
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function renderDetails(details) {
    if (!details.length)
        return '';
    const rows = details
        .map((item) => `
      <tr>
        <td style="padding:8px 0;color:#55607a;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;vertical-align:top;">${escapeHtml(item.label)}</td>
        <td style="padding:8px 0;color:#0c1b42;font-size:14px;font-weight:600;text-align:right;vertical-align:top;">${escapeHtml(item.value)}</td>
      </tr>
    `)
        .join('');
    return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 8px;border-top:1px solid #e3e8f1;border-bottom:1px solid #e3e8f1;">
      ${rows}
    </table>
  `;
}
export function renderBrandedEmail(options) {
    const messages = options.message
        .map((line) => `<p style="margin:0 0 12px;color:#2a3655;font-size:14px;line-height:1.75;">${escapeHtml(line)}</p>`)
        .join('');
    const details = options.details ? renderDetails(options.details) : '';
    const cta = options.ctaLabel && options.ctaUrl
        ? `
      <div style="margin:22px 0 0;">
        <a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;background:#ff8a00;color:#0c1b42;font-weight:700;text-decoration:none;padding:12px 20px;font-size:13px;font-weight:600;letter-spacing:0.04em;border-radius:8px;">${escapeHtml(options.ctaLabel)}</a>
      </div>
    `
        : '';
    const accent = options.accentText
        ? `<p style="margin:18px 0 0;color:#b84a00;font-size:13px;line-height:1.65;">${escapeHtml(options.accentText)}</p>`
        : '';
    return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${escapeHtml(options.title)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(options.preheader ?? options.title)}</span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:26px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e3e8f1;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(41,28,15,0.08);">
                <tr>
                  <td style="padding:18px 24px;background:#0c1b42;border-bottom:3px solid #ff8a00;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <p style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:0.04em;"><span style="color:#ff8a00;">K</span>TMONA</p>
                          <p style="margin:4px 0 0;color:#c3cce3;font-size:12px;letter-spacing:0.06em;">Trust Every Click</p>
                        </td>
                        <td align="right" style="vertical-align:top;">
                          <span style="display:inline-block;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#ffffff;border-radius:999px;padding:5px 10px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;">Official Mail</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:26px 24px 12px;">
                    ${options.eyebrow
        ? `<p style="margin:0 0 10px;color:#b84a00;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(options.eyebrow)}</p>`
        : ''}
                    <h1 style="margin:0 0 14px;color:#0c1b42;font-size:30px;line-height:1.2;font-weight:600;">${escapeHtml(options.title)}</h1>
                    ${options.greeting
        ? `<p style="margin:0 0 14px;color:#2a3655;font-size:14px;line-height:1.75;">${escapeHtml(options.greeting)}</p>`
        : ''}
                    ${messages}
                    ${details}
                    ${cta}
                    ${accent}
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 24px 24px;border-top:1px solid #e3e8f1;background:#f8fafd;">
                    <p style="margin:0;color:#55607a;font-size:12px;line-height:1.7;font-family:Arial,sans-serif;">
                      Need assistance? Reply to this email and our support team will help you.
                    </p>
                    <p style="margin:8px 0 0;color:#7d88a3;font-size:11px;line-height:1.6;font-family:Arial,sans-serif;">
                      You are receiving this because of activity on your KTMONA account.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
//# sourceMappingURL=layout.js.map