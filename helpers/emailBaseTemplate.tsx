// Shared HTML email builder used by every Testkart email - the code-driven
// templates in helpers/emailTemplates.tsx / emailTemplatesExtra.tsx /
// studentTemplateEmails.tsx, the standalone OTP/notification emails, and the
// admin-editable templates stored in the `email_templates` DB table.
//
// It renders two layouts. Student emails (studentAppPromo: true) use the
// student layout, which follows the student pages and /app (base.css --sp-*,
// --fc-*). Teacher and admin emails use the classic layout (base.css
// --primary / --secondary / --success / --warning / --error).
//
// Both are written for Gmail first: table layout, inline styles, no flexbox,
// no web fonts, and nothing that depends on the <style> block surviving.

import { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "./brandAssets";

export type EmailAccent = "brand" | "success" | "warning" | "danger" | "info";

/** Student layout colours, named after the student page tokens (base.css --sp-*, --fc-*). */
export type EmailTone = "lavender" | "sage" | "mint" | "blue" | "peach" | "butter";

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
  // --tk-brand-deep: 7.9:1 under white text, so buttons use it.
  primaryDeep: "#903209",
  secondary: "#14B8A5",
  text: "#2E3138",
  muted: "#676F7E",
  border: "#E5E7EB",
  background: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceMuted: "#F9FAFB",
};

const LOGO_URL = BRAND_LOGO_LIGHT;
// White wordmark for the dark header strip of the student layout. A dark strip
// keeps the logo readable when Gmail's dark mode recolours light backgrounds.
const LOGO_ON_DARK_URL = BRAND_LOGO_DARK;

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
  /** Classic layout only: a single emoji inside the accent circle above the heading. */
  icon?: string;
  /** Student layout only: a short label above the heading, e.g. "Order confirmed". */
  eyebrow?: string;
  /** Colours the icon circle (classic). In the student layout it picks the tone when none is given. */
  accent?: EmailAccent;
  /** Student layout only: colours the hero block, the button and the code box. */
  tone?: EmailTone;
  /** Omit for a letter-style email that opens straight into the body. */
  heading?: string;
  subheading?: string;
  /** Pre-built inner HTML (paragraphs, lists, etc.) rendered inside the content card. */
  bodyHtml?: string;
  /** Classic layout only: "plain" sets the body on the white page instead of the grey content card. */
  bodyVariant?: "card" | "plain";
  /** Renders a large centered code box, used for OTP emails. */
  codeBlock?: string;
  /** Renders a simple label/value summary table (order totals, subscription details, etc.). */
  table?: EmailTableRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  /** Button fill. Defaults to EMAIL_BRAND.primaryDeep (classic) or the tone (student). */
  ctaColor?: string;
  /** Pre-built HTML rendered below the button. */
  afterCtaHtml?: string;
  /** Optional extra line shown in the footer. */
  footerNote?: string;
  /** Marks a student email: renders the student layout, which ends with the app-download block. */
  studentAppPromo?: boolean;
}

export const escapeEmailHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** "₹499" for whole amounts, "₹499.50" otherwise. */
export const formatEmailRupees = (amount: number): string =>
  `₹${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

// The server clock is not on Indian time, so every date shown to a user names the zone.
export const formatEmailDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);

export const formatEmailDateTime = (date: Date): string =>
  `${new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date)} IST`;

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.testkart.mocktest.courses.studynotes";
const PLAY_BADGE_URL =
  "https://cdn.testkart.in/platform/app/google-playstore.png";
const APP_PROMO_MARKER = "<!--tk-app-promo-->";

// The block withStudentAppPromo adds to a stored template in the classic layout.
const CLASSIC_APP_PROMO_HTML = `${APP_PROMO_MARKER}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:${EMAIL_BRAND.surface};border:1px solid ${EMAIL_BRAND.border};border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;text-align:center;">
                    <p style="color:${EMAIL_BRAND.text};margin:0 0 6px;font-size:17px;font-weight:700;">Study on the Go.</p>
                    <p style="color:${EMAIL_BRAND.muted};margin:0 0 12px;font-size:14px;line-height:1.5;">Mock tests, notes and progress, all in the Testkart app.</p>
                    <a href="${PLAY_STORE_URL}" style="display:inline-block;text-decoration:none;">
                      <img src="${PLAY_BADGE_URL}" alt="Get it on Google Play" width="150" height="45" style="display:block;width:150px;max-width:100%;height:auto;border:0;">
                    </a>
                    <p style="color:${EMAIL_BRAND.muted};margin:4px 0 0;font-size:12px;">Available on Google Play.</p>
                  </td>
                </tr>
              </table>`;

const FOOTER_CELL_PATTERN = /<td[^>]*border-top:1px solid #E5E7EB;text-align:center;[^>]*>/i;

/**
 * Adds the app-download block to an already-rendered classic email, such as a
 * shared admin-editable template from the email_templates table. Returns the
 * HTML unchanged if the block is already there (every student-layout email
 * carries it) or the footer cell can't be found.
 */
export const withStudentAppPromo = (html: string): string => {
  if (html.includes(APP_PROMO_MARKER)) return html;
  const match = FOOTER_CELL_PATTERN.exec(html);
  if (!match) return html;
  const insertAt = match.index + match[0].length;
  return `${html.slice(0, insertAt)}
              ${CLASSIC_APP_PROMO_HTML}${html.slice(insertAt)}`;
};

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

// Student layout. Hex copies of the palette the student pages and /app use
// (base.css --sp-*, --fc-*, --co-*), since email clients don't reliably
// support hsl() or custom properties.
const STUDENT = {
  page: "#FCFBF8",
  card: "#FFFFFF",
  panel: "#FAF6F0",
  line: "#E4DFD7",
  ink: "#21283B",
  text: "#3D4351",
  muted: "#555D6D",
  // --fc-panel, the deep pine panel. Dark so the logo survives Gmail's dark mode.
  band: "#1A322F",
  // --fc-panel-ink
  bandInk: "#F9F6F0",
};

// tint (-tint): hero and code box fill. ink (-ink): label text on the tint.
// fill (-line, or --sp-cta for peach): button fill and code box border, under
// STUDENT.ink text.
const STUDENT_TONES: Record<EmailTone, { tint: string; ink: string; fill: string }> = {
  lavender: { tint: "#E9E3F7", ink: "#433465", fill: "#C6BDDB" },
  sage: { tint: "#E0ECDA", ink: "#294224", fill: "#BDCFB4" },
  mint: { tint: "#CDEEDF", ink: "#194838", fill: "#89BDA9" },
  blue: { tint: "#D2E6F9", ink: "#1E426B", fill: "#B3CCE6" },
  peach: { tint: "#FFDDC7", ink: "#7C2F0E", fill: "#FDBA91" },
  butter: { tint: "#FCEDC5", ink: "#573A0F", fill: "#E4CD95" },
};

// Lavender is the palette's default accent. It has no red: problems use peach.
const ACCENT_TONES: Record<EmailAccent, EmailTone> = {
  brand: "lavender",
  success: "sage",
  warning: "butter",
  danger: "peach",
  info: "blue",
};

// Gmail does not load web fonts, so this falls through to Roboto or Segoe UI there.
const STUDENT_FONT = "'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Progressive only: Gmail drops the whole <style> block in some accounts, and
// the layout holds without it.
const STUDENT_MOBILE_CSS = `
  @media only screen and (max-width:600px) {
    .tk-outer { padding:12px 8px 24px !important; }
    .tk-band { padding:14px 20px !important; }
    .tk-hero { padding:22px 20px 24px !important; }
    .tk-body { padding:22px 20px 28px !important; }
    .tk-h1 { font-size:24px !important; }
    .tk-btn { width:100% !important; }
    .tk-btn a { display:block !important; text-align:center !important; }
    .tk-code { font-size:30px !important; letter-spacing:6px !important; }
  }`;

const STUDENT_APP_PROMO_HTML = `${APP_PROMO_MARKER}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${STUDENT.card}" style="background-color:${STUDENT.card};border:1px solid ${STUDENT.line};border-radius:14px;border-collapse:separate;">
              <tr>
                <td valign="middle" style="padding:14px 8px 14px 20px;font-family:${STUDENT_FONT};">
                  <p style="margin:0;font-size:15px;line-height:1.35;font-weight:700;color:${STUDENT.ink};">Study on the go</p>
                  <p style="margin:2px 0 0;font-size:13px;line-height:1.45;color:${STUDENT.muted};">Tests, notes and results in the Testkart app.</p>
                </td>
                <td valign="middle" align="right" width="148" style="padding:12px 14px 12px 0;">
                  <a href="${PLAY_STORE_URL}" style="text-decoration:none;"><img src="${PLAY_BADGE_URL}" alt="Get it on Google Play" width="130" height="39" style="display:block;width:130px;height:auto;border:0;"></a>
                </td>
              </tr>
            </table>`;

const renderStudentTable = (rows: EmailTableRow[] | undefined): string => {
  if (!rows || rows.length === 0) return "";
  const rowsHtml = rows
    .map((row, index) => {
      const divider = index > 0 ? `border-top:1px solid ${STUDENT.line};` : "";
      return `
                  <tr>
                    <td valign="top" style="padding:12px 16px;${divider}font-family:${STUDENT_FONT};font-size:14px;line-height:1.45;color:${STUDENT.muted};">${row.label}</td>
                    <td valign="top" align="right" style="padding:12px 16px;${divider}font-family:${STUDENT_FONT};text-align:right;font-size:${row.emphasize ? "16px" : "14px"};line-height:1.45;font-weight:${row.emphasize ? "800" : "600"};color:${STUDENT.ink};">${row.value}</td>
                  </tr>`;
    })
    .join("");

  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${STUDENT.panel}" style="margin:20px 0 0;background-color:${STUDENT.panel};border:1px solid ${STUDENT.line};border-radius:12px;border-collapse:separate;">${rowsHtml}
                </table>`;
};

const renderStudentEmail = (options: BrandedEmailOptions): string => {
  const tone = STUDENT_TONES[options.tone ?? ACCENT_TONES[options.accent ?? "brand"]];
  const preheader = options.preheaderText ?? options.subheading ?? options.title;

  const eyebrowHtml = options.eyebrow
    ? `
              <p style="margin:0 0 10px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${tone.ink};">${options.eyebrow}</p>`
    : "";

  const headingHtml = options.heading
    ? `
              <h1 class="tk-h1" style="margin:0;font-family:${STUDENT_FONT};font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${STUDENT.ink};">${options.heading}</h1>`
    : "";

  const subheadingHtml = options.subheading
    ? `
              <p style="margin:8px 0 0;font-size:15px;line-height:1.5;color:${STUDENT.text};">${options.subheading}</p>`
    : "";

  // The hero carries the email's colour, so one glance tells an order from a
  // live test from a problem.
  const heroHtml =
    eyebrowHtml || headingHtml || subheadingHtml
      ? `
          <tr>
            <td class="tk-hero" bgcolor="${tone.tint}" style="background-color:${tone.tint};border-left:1px solid ${tone.tint};border-right:1px solid ${tone.tint};padding:28px 32px 30px;font-family:${STUDENT_FONT};text-align:left;">${eyebrowHtml}${headingHtml}${subheadingHtml}
            </td>
          </tr>`
      : "";

  const bodyHtml = options.bodyHtml
    ? `
                <div style="margin:0;font-size:16px;line-height:1.6;color:${STUDENT.text};">${options.bodyHtml}</div>`
    : "";

  const codeBlockHtml = options.codeBlock
    ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${tone.tint}" style="margin:20px 0 0;background-color:${tone.tint};border:1px solid ${tone.fill};border-radius:14px;border-collapse:separate;">
                  <tr>
                    <td align="center" style="padding:20px 12px;"><span class="tk-code" style="font-family:${STUDENT_FONT};font-size:34px;line-height:1.2;font-weight:800;letter-spacing:8px;color:${STUDENT.ink};">${options.codeBlock}</span></td>
                  </tr>
                </table>`
    : "";

  const ctaHtml =
    options.ctaLabel && options.ctaUrl
      ? `
                <table role="presentation" class="tk-btn" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;border-collapse:separate;">
                  <tr>
                    <td align="center" bgcolor="${options.ctaColor ?? tone.fill}" style="background-color:${options.ctaColor ?? tone.fill};border-radius:999px;"><a href="${options.ctaUrl}" style="display:inline-block;padding:14px 28px;font-family:${STUDENT_FONT};font-size:16px;line-height:20px;font-weight:700;color:${options.ctaColor ? "#ffffff" : STUDENT.ink};text-decoration:none;border-radius:999px;">${options.ctaLabel}</a></td>
                  </tr>
                </table>`
      : "";

  const afterCtaHtml = options.afterCtaHtml
    ? `
                <div style="margin:24px 0 0;font-size:14px;line-height:1.6;color:${STUDENT.muted};">${options.afterCtaHtml}</div>`
    : "";

  const footerNoteHtml = options.footerNote
    ? `
              <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${STUDENT.muted};">${options.footerNote}</p>`
    : "";

  const footerLink = (label: string, url: string) =>
    `<a href="${url}" style="color:${STUDENT.muted};text-decoration:underline;">${label}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${options.title}</title>
<style>${STUDENT_MOBILE_CSS}
</style>
</head>
<body style="margin:0;padding:0;background-color:${STUDENT.page};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${STUDENT.page};">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${STUDENT.page}" style="background-color:${STUDENT.page};">
    <tr>
      <td class="tk-outer" align="center" style="padding:28px 12px 36px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr>
            <td class="tk-band" bgcolor="${STUDENT.band}" style="background-color:${STUDENT.band};border-radius:18px 18px 0 0;padding:16px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" align="left"><a href="https://testkart.in" style="text-decoration:none;"><img src="${LOGO_ON_DARK_URL}" alt="Testkart" width="94" height="26" style="display:block;width:94px;height:26px;border:0;"></a></td>
                  <td valign="middle" align="right" style="font-family:${STUDENT_FONT};font-size:13px;line-height:18px;font-weight:600;text-align:right;"><a href="https://testkart.in/student/dashboard" style="color:${STUDENT.bandInk};text-decoration:underline;">My dashboard</a></td>
                </tr>
              </table>
            </td>
          </tr>${heroHtml}
          <tr>
            <td class="tk-body" bgcolor="${STUDENT.card}" style="background-color:${STUDENT.card};border:1px solid ${STUDENT.line};border-top:0;border-radius:0 0 18px 18px;padding:28px 32px 34px;font-family:${STUDENT_FONT};text-align:left;">${bodyHtml}${codeBlockHtml}${renderStudentTable(options.table)}${ctaHtml}${afterCtaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0 0;">
              ${STUDENT_APP_PROMO_HTML}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 16px 0;font-family:${STUDENT_FONT};text-align:center;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:${STUDENT.muted};">Need help? Write to <a href="mailto:support@testkart.in" style="color:${STUDENT.ink};font-weight:600;text-decoration:underline;">support@testkart.in</a></p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${STUDENT.muted};">${footerLink("Instagram", "https://www.instagram.com/testkart")} &nbsp;&middot;&nbsp; ${footerLink("Telegram", "https://t.me/testkart_in")} &nbsp;&middot;&nbsp; ${footerLink("X", "https://x.com/testkart_in")} &nbsp;&middot;&nbsp; ${footerLink("LinkedIn", "https://www.linkedin.com/company/testkart")}</p>${footerNoteHtml}
              <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${STUDENT.muted};">Testkart &middot; testkart.in</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const getBrandedEmailHtml = (options: BrandedEmailOptions): string => {
  if (options.studentAppPromo) return renderStudentEmail(options);

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
        <a href="${options.ctaUrl}" style="display:inline-block;background-color:${options.ctaColor ?? EMAIL_BRAND.primaryDeep};color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${options.ctaLabel} &rarr;</a>
      </div>`
      : "";

  const afterCtaHtml = options.afterCtaHtml
    ? `<div style="color:${EMAIL_BRAND.text};font-size:15px;line-height:1.65;margin-top:28px;">${options.afterCtaHtml}</div>`
    : "";

  const headerHtml =
    options.heading || options.icon || options.subheading
      ? `<div style="text-align:center;margin-bottom:28px;">
                ${iconHtml}
                ${options.heading ? `<h1 style="color:${EMAIL_BRAND.text};margin:0 0 8px;font-size:24px;font-weight:700;">${options.heading}</h1>` : ""}
                ${subheadingHtml}
              </div>`
      : "";

  const hasCardContent = Boolean(options.bodyHtml || options.codeBlock || options.table);
  const contentHtml = !hasCardContent
    ? ""
    : options.bodyVariant === "plain"
      ? `${bodyHtml}${codeBlockHtml}${tableHtml}`
      : `<div style="background-color:${EMAIL_BRAND.surfaceMuted};border-radius:12px;padding:24px;">
                      ${bodyHtml}
                      ${codeBlockHtml}
                      ${tableHtml}
                    </div>`;

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
            <td style="background-color:${EMAIL_BRAND.primaryDeep};height:5px;line-height:5px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 40px;text-align:center;border-bottom:1px solid ${EMAIL_BRAND.border};">
              <img src="${LOGO_URL}" alt="Testkart" height="32" style="height:32px;width:auto;display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="padding:44px 40px 40px;">
              ${headerHtml}
              ${contentHtml}
              ${ctaHtml}
              ${afterCtaHtml}
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
