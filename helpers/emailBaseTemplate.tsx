// Shared, branded HTML email template used by EVERY Testkart email — the
// code-driven templates in helpers/emailTemplates.tsx / emailTemplatesExtra.tsx,
// the standalone OTP/notification emails, and the admin-editable templates
// stored in the `email_templates` DB table all render through this builder
// so the whole platform sends one consistent, on-brand design.
//
// Colors are pulled from the app's real design tokens (base.css --primary /
// --secondary / --success / --warning / --error), not an arbitrary palette,
// so emails actually look like they came from the same product as the app.

export type EmailAccent = "brand" | "success" | "warning" | "danger" | "info";

const ACCENT_STYLES: Record<EmailAccent, { solid: string; tint: string }> = {
  brand: { solid: "#FF7A33", tint: "#FFF1E8" },
  success: { solid: "#16A34A", tint: "#ECFDF3" },
  warning: { solid: "#D97706", tint: "#FFFBEB" },
  danger: { solid: "#DC2626", tint: "#FEF2F2" },
  info: { solid: "#0EA5E9", tint: "#EFF8FF" },
};

// Brand tokens (mirrors base.css --primary / --secondary in hex, since email
// clients don't reliably support hsl()).
export const EMAIL_BRAND = {
  primary: "#FF9966",
  primaryDark: "#FF7A33",
  secondary: "#14B8A5",
  text: "#2E3138",
  muted: "#676F7E",
  border: "#E5E7EB",
  background: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceMuted: "#F9FAFB",
};

const LOGO_URL = "https://cdn.testkart.in/branding/logo-light.png";

export interface EmailTableRow {
  label: string;
  value: string;
  emphasize?: boolean;
}

export interface BrandedEmailOptions {
  /** Used for <title> and as a fallback preheader. */
  title: string;
  /** Hidden preview text shown next to the subject in inbox lists. */
  preheaderText?: string;
  /** A single emoji rendered inside the accent circle above the heading. */
  icon?: string;
  /** Controls the icon circle / heading accent color. Defaults to "brand". */
  accent?: EmailAccent;
  heading: string;
  subheading?: string;
  /** Pre-built inner HTML (paragraphs, lists, etc.) rendered inside the content card. */
  bodyHtml?: string;
  /** Renders a large centered code box — used for OTP-style emails. */
  codeBlock?: string;
  /** Renders a simple label/value summary table (order totals, subscription details, etc.). */
  table?: EmailTableRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  /** Optional extra line shown above the copyright in the footer. */
  footerNote?: string;
}

const renderTable = (rows: EmailTableRow[] | undefined): string => {
  if (!rows || rows.length === 0) return "";
  const rowsHtml = rows
    .map(
      (row, index) => `
        <tr>
          <td style="padding:12px 0;${index < rows.length - 1 ? `border-bottom:1px solid ${EMAIL_BRAND.border};` : ""}color:${EMAIL_BRAND.muted};font-size:14px;">${row.label}</td>
          <td style="padding:12px 0;${index < rows.length - 1 ? `border-bottom:1px solid ${EMAIL_BRAND.border};` : ""}text-align:right;font-size:${row.emphasize ? "16px" : "14px"};font-weight:${row.emphasize ? "700" : "500"};color:${EMAIL_BRAND.text};">${row.value}</td>
        </tr>`
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;">
      <tbody>${rowsHtml}</tbody>
    </table>`;
};

export const emailTableRows = renderTable;

export const getBrandedEmailHtml = (options: BrandedEmailOptions): string => {
  const accent = ACCENT_STYLES[options.accent ?? "brand"];
  const preheader = options.preheaderText ?? options.subheading ?? options.title;

  // The glyph is centered with line-height, NOT flexbox: Gmail's CSS sanitizer
  // strips display:flex/align-items/justify-content, which left the icon ~17px
  // above center and clipping out the top of the circle. line-height === the
  // circle height works in every client, including Gmail and Outlook.
  const iconHtml = options.icon
    ? `
      <div style="width:64px;height:64px;background-color:${accent.tint};border-radius:50%;margin:0 auto 20px;text-align:center;">
        <span style="font-size:30px;line-height:64px;">${options.icon}</span>
      </div>`
    : "";

  const subheadingHtml = options.subheading
    ? `<p style="color:${EMAIL_BRAND.muted};margin:0;font-size:15px;">${options.subheading}</p>`
    : "";

  const bodyHtml = options.bodyHtml
    ? `<div style="color:${EMAIL_BRAND.text};font-size:15px;line-height:1.65;">${options.bodyHtml}</div>`
    : "";

  const codeBlockHtml = options.codeBlock
    ? `
      <div style="background-color:${EMAIL_BRAND.surfaceMuted};border:1px solid ${EMAIL_BRAND.border};border-radius:10px;padding:20px;margin:24px 0;text-align:center;">
        <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:${EMAIL_BRAND.text};">${options.codeBlock}</span>
      </div>`
    : "";

  const tableHtml = renderTable(options.table);

  const ctaHtml =
    options.ctaLabel && options.ctaUrl
      ? `
      <div style="text-align:center;margin-top:28px;">
        <a href="${options.ctaUrl}" style="display:inline-block;background-color:${EMAIL_BRAND.primaryDark};color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${options.ctaLabel} &rarr;</a>
      </div>`
      : "";

  const footerNoteHtml = options.footerNote
    ? `<p style="color:${EMAIL_BRAND.muted};margin:0 0 8px;font-size:12px;">${options.footerNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${options.title}</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_BRAND.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:${EMAIL_BRAND.surface};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,0.06);">
          <tr>
            <td style="background:linear-gradient(90deg,${EMAIL_BRAND.primary} 0%,${EMAIL_BRAND.secondary} 100%);height:5px;line-height:5px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 40px;text-align:center;border-bottom:1px solid ${EMAIL_BRAND.border};">
              <img src="${LOGO_URL}" alt="Testkart" height="32" style="height:32px;width:auto;display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="padding:44px 40px 40px;">
              <div style="text-align:center;margin-bottom:28px;">
                ${iconHtml}
                <h1 style="color:${EMAIL_BRAND.text};margin:0 0 8px;font-size:24px;font-weight:700;">${options.heading}</h1>
                ${subheadingHtml}
              </div>
              ${
                options.bodyHtml || options.codeBlock || options.table
                  ? `<div style="background-color:${EMAIL_BRAND.surfaceMuted};border-radius:12px;padding:24px;">
                      ${bodyHtml}
                      ${codeBlockHtml}
                      ${tableHtml}
                    </div>`
                  : ""
              }
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${EMAIL_BRAND.surfaceMuted};padding:28px 40px;border-top:1px solid ${EMAIL_BRAND.border};text-align:center;">
              <div style="margin-bottom:16px;">
                <a href="https://www.instagram.com/testkart" style="display:inline-block;margin:0 8px;color:${EMAIL_BRAND.muted};text-decoration:none;font-size:12px;">Instagram</a>
                <a href="https://x.com/testkart_in" style="display:inline-block;margin:0 8px;color:${EMAIL_BRAND.muted};text-decoration:none;font-size:12px;">X (Twitter)</a>
                <a href="https://www.linkedin.com/company/testkart" style="display:inline-block;margin:0 8px;color:${EMAIL_BRAND.muted};text-decoration:none;font-size:12px;">LinkedIn</a>
                <a href="https://t.me/testkart_in" style="display:inline-block;margin:0 8px;color:${EMAIL_BRAND.muted};text-decoration:none;font-size:12px;">Telegram</a>
              </div>
              ${footerNoteHtml}
              <p style="color:${EMAIL_BRAND.muted};margin:0;font-size:12px;">&copy; ${new Date().getFullYear()} Testkart. All rights reserved.</p>
              <p style="color:${EMAIL_BRAND.muted};margin:6px 0 0;font-size:12px;">Questions? Contact us at support@testkart.in</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
