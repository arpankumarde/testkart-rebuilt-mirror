import type { OnboardingEmailKey } from "./teacherOnboardingSchedule";

/**
 * Copy and layout for the eight teacher onboarding emails (timing lives in
 * helpers/teacherOnboardingSchedule). Source: the "Testkart Teacher Onboarding
 * Emails" doc (v3), signed by Shivangi.
 *
 * The layout is its own, not emailBaseTemplate: a white page with no tinted
 * background, card or header strip. The hero image (with the logo in it) opens
 * each email. Built for Gmail, Apple Mail, Outlook desktop and Outlook.com:
 * tables, inline styles, px line heights, a VML button for Outlook, and no
 * layout that depends on the <style> block.
 *
 * Text uses a small markup: [label](url) becomes a link and **text** is bold.
 * Every testkart.in link carries the CRM UTMs with its own utm_content;
 * YouTube links carry none.
 */

export type OnboardingRenderContext = {
  /** users.display_name; reduced to a first name or "there". */
  displayName: string | null;
  published: boolean;
  unsubscribeUrl: string;
};

type Link = { url: string; video: boolean };

type OnboardingEmail = {
  subject: string;
  preheader: string;
  hero: { image: string; alt: string; link: Link };
  paragraphs: string[];
  bullets: string[];
  cta: { label: string; url: string };
  shorts?: { image: string; alt: string; label: string; url: string; width: number }[];
};

const SITE_URL = "https://testkart.in";
const IMAGE_BASE = "https://cdn.testkart.in/platform/marketing/emails-sequence";

const COLOR = {
  text: "#1F2328",
  muted: "#5B626C",
  link: "#C2410C",
  button: "#E8620C",
  rule: "#E5E7EB",
};

const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const site = (path: string, content: string) =>
  `${SITE_URL}${path}?utm_source=testkart_crm&utm_medium=email&utm_campaign=teacher_onboarding&utm_content=${content}`;
const image = (n: number) => `${IMAGE_BASE}/image${n}.png`;
const page = (path: string, content: string): Link => ({ url: site(path, content), video: false });
const youtube = (url: string): Link => ({ url, video: true });

const EMAILS = (ctx: OnboardingRenderContext): Record<OnboardingEmailKey, OnboardingEmail> => ({
  e1: {
    subject: "Your Testkart account is ready",
    preheader: "Free to join. No upfront cost.",
    hero: {
      image: image(1),
      alt: "Your Testkart teacher account is live. Free to join, earn up to ₹200 in Creator Bonus.",
      link: page("/teacher/dashboard", "e1_hero_dashboard"),
    },
    paragraphs: [
      "Your **Testkart** teacher account is ready, and joining is free.",
      `Earn up to **₹200 in Creator Bonus**. [See the Creator Bonus](${site("/teacher/creator-bonus", "e1_link_creator_bonus")}).`,
    ],
    bullets: [
      "**Mock tests:** Sell a test series or single papers with timers and marks.",
      "**Notes and PDFs:** Upload a file, set a price, or make it free.",
    ],
    cta: { label: "Open my dashboard", url: site("/teacher/dashboard", "e1_btn_dashboard") },
  },
  e2: {
    subject: "Turn your question papers into a mock test",
    preheader: "5-minute video. Plus ₹100 for a great series.",
    hero: {
      image: image(2),
      alt: "Play the 5-minute video: turn your question papers into a mock test on Testkart.",
      link: youtube("https://www.youtube.com/watch?v=Jdz4LRGt2bQ"),
    },
    paragraphs: [
      "Already have questions in **Word or Excel**? You're halfway there.",
      "Use the 5-minute video to set up your test series.",
    ],
    bullets: [
      `Get the CSV or Excel template from [Question Bank](${site("/teacher/question-bank", "e2_link_question_bank")}) > Bulk Upload.`,
      `A series with 10+ tests and 500+ questions can earn ₹100 after review. [See the Creator Bonus](${site("/teacher/creator-bonus", "e2_link_creator_bonus")}).`,
    ],
    cta: { label: "Create my first test series", url: site("/teacher/create-test", "e2_btn_create_test") },
  },
  e3: {
    subject: "Students check this page before they buy",
    preheader: "Two fields and a photo. About 5 minutes.",
    hero: {
      image: image(3),
      alt: "Your Testkart profile page: add a tagline, an about section and a photo.",
      link: page("/teacher/edit-profile", "e3_hero_profile"),
    },
    paragraphs: ["Students check your profile before they buy.", "Complete it in about 5 minutes."],
    bullets: [
      "**Tagline:** Say what you teach and which exam.",
      "**About you:** Add your teaching years, exams and student results.",
    ],
    cta: { label: "Finish my profile", url: site("/teacher/edit-profile", "e3_btn_profile") },
  },
  e4: {
    subject: "Those notes on your laptop can earn",
    preheader: "Upload a PDF, set a price, done.",
    hero: {
      image: image(4),
      alt: "Play the 3-minute video: upload your notes and PDFs and set a price.",
      link: youtube("https://www.youtube.com/watch?v=aQg3lFftXi8"),
    },
    paragraphs: ["Your existing **PDFs can earn money on Testkart**.", "Upload a file, set a price and publish."],
    bullets: [
      "**Start with a free PDF.** Students can see how you teach.",
      "Edit or remove the PDF any time after it goes live.",
    ],
    cta: { label: "Upload my first PDF", url: site("/teacher/products/create", "e4_btn_create_notes") },
  },
  e5: {
    subject: "Run a live mock test on a fixed date",
    preheader: "Every student starts at the same time.",
    hero: {
      image: image(5),
      alt: "Play the 6-minute video: run a live mock test on a fixed date.",
      link: youtube("https://www.youtube.com/watch?v=Q4rLMYnTQAc"),
    },
    paragraphs: [
      "A **live test** starts at a set time, like a real exam.",
      "Create it like a test series, then set the date, time and entry fee.",
    ],
    bullets: [
      "It appears on the **Testkart** homepage with a countdown.",
      "Add a prize pool to attract more students.",
    ],
    cta: { label: "Schedule my first live test", url: site("/teacher/create-live-test", "e5_btn_create_live_test") },
  },
  e6: {
    subject: "Put your recorded classes on sale",
    preheader: "Sections, lessons, one price. ₹100 for a great one.",
    hero: {
      image: image(6),
      alt: "Put your recorded classes on sale as a Testkart course.",
      link: page("/teacher/courses/create", "e6_hero_course"),
    },
    paragraphs: [
      "**Sell recorded classes as a course**. Students pay once and watch on mobile or desktop.",
      `A course can earn ₹100 with 10+ Testkart videos, 10+ minutes each and 200+ minutes total. YouTube links do not count. [See the Creator Bonus](${site("/teacher/creator-bonus", "e6_link_creator_bonus")}).`,
    ],
    bullets: [
      "Use sections as chapters and lessons as classes. Set one price or make the course free.",
      `Add a test and PDF to your course as a [bundle](${site("/teacher/bundles/create", "e6_link_bundle")}) and sell all three at one price.`,
    ],
    cta: { label: "Build my first course", url: site("/teacher/courses/create", "e6_btn_create_course") },
  },
  e7: {
    subject: "Build one test series. Unlock your bank account.",
    preheader: "Earn ₹100 from Testkart and your payouts open up.",
    hero: {
      image: image(7),
      alt: "Your first ₹100 unlocks your bank account. One Creator Bonus gets you there.",
      link: page("/teacher/creator-bonus", "e7_hero_creator_bonus"),
    },
    paragraphs: ["Earn from student sales and the **Creator Bonus**.", "At **₹100**, add bank details and withdraw."],
    bullets: [
      "Earn ₹100 for 1 qualifying test series and ₹100 for 1 qualifying course (₹200 total). Series need 10+ tests and 500+ questions.",
      `Courses need 10+ Testkart videos, 10+ minutes each and 200+ minutes total; YouTube links do not count. Each item earns once after review. At ₹100, add your bank account on [Earnings page](${site("/teacher/earnings", "e7_link_earnings")}).`,
    ],
    cta: { label: "See my Creator Bonus", url: site("/teacher/creator-bonus", "e7_btn_creator_bonus") },
  },
  e8: {
    subject: "Build your tests from ChatGPT or Claude",
    preheader: "Plus what other teachers say about Testkart.",
    hero: {
      image: image(8),
      alt: "Play the 7-minute video: connect ChatGPT, Claude or Perplexity to Testkart.",
      link: youtube("https://www.youtube.com/watch?v=GRzh-sJ2fJs"),
    },
    paragraphs: [
      "Connect **Testkart to ChatGPT, Claude or Perplexity.** Nothing changes until you sign in and select Allow.",
      ctx.published
        ? "Need help with your next listing? Reply to this email and our team will help."
        : "Need help with your first listing? Reply to this email and our team will help.",
    ],
    bullets: [
      '"Write 20 questions on the Indian Constitution for my UPSC test."',
      '"How many sales did I make this week?"',
    ],
    cta: {
      label: "Connect my AI assistant",
      url: site("/help/connect-ai-assistant-testkart", "e8_btn_ai_help"),
    },
    shorts: [
      {
        image: image(9),
        alt: "Play video: what teachers say about Testkart.",
        label: "What teachers say about Testkart",
        url: "https://www.youtube.com/shorts/1TtssJbN6mo",
        width: 266,
      },
      {
        image: image(10),
        alt: "Play video: real experiences with Testkart.",
        label: "Real experiences with Testkart",
        url: "https://www.youtube.com/shorts/C_rlxVEm1cY",
        width: 261,
      },
    ],
  },
});

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "er", "sir", "shri", "sri", "smt", "adv", "ca"]);
const NOT_A_PERSON = /academy|classes|tutorial|institute|coaching|testing|toppers|official|education|publication|scholars|teaching|study|setu|^user_/i;

/** "Himanshi" from "HIMANSHI KHICHAWAT"; null for "User_23054", "Pharma Scholars Academy" and the like. */
export function onboardingFirstName(displayName: string | null): string | null {
  const name = (displayName ?? "").trim();
  if (!name || NOT_A_PERSON.test(name)) return null;
  const words = name.split(/\s+/).map((word) => word.replace(/[.,]+$/, ""));
  const first = words.find((word) => !HONORIFICS.has(word.toLowerCase()));
  if (!first || first.length < 2 || !/^\p{L}[\p{L}\p{M}'-]*$/u.test(first)) return null;
  const sameCase = first === first.toLowerCase() || first === first.toUpperCase();
  return sameCase ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : first;
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const BOLD = /\*\*(.+?)\*\*/g;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inlineHtml = (value: string) =>
  escapeHtml(value)
    .replace(
      LINK,
      (_match, label: string, url: string) =>
        `<a href="${url}" target="_blank" style="color:${COLOR.link};text-decoration:underline;">${label}</a>`
    )
    .replace(BOLD, (_match, inner: string) => `<strong style="font-weight:700;">${inner}</strong>`);

const inlineText = (value: string) =>
  value.replace(LINK, (_match, label: string, url: string) => `${label} (${url})`).replace(BOLD, "$1");

const TEXT_STYLE = `font-family:${FONT};font-size:16px;line-height:26px;color:${COLOR.text};`;

const paragraphHtml = (value: string, bottom = 16) =>
  `<p style="margin:0 0 ${bottom}px;${TEXT_STYLE}">${value}</p>`;

const bulletsHtml = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${items
    .map(
      (item) => `
            <tr>
              <td width="22" valign="top" style="${TEXT_STYLE}padding:0 0 10px;">&bull;</td>
              <td valign="top" style="${TEXT_STYLE}padding:0 0 10px;">${inlineHtml(item)}</td>
            </tr>`
    )
    .join("")}
          </table>`;

// Outlook desktop draws the VML shape; every other client gets the plain link.
const buttonHtml = (label: string, url: string) => {
  const width = Math.min(400, Math.max(220, label.length * 11 + 64));
  const text = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 28px;">
            <tr>
              <td align="center" bgcolor="${COLOR.button}" style="border-radius:8px;background-color:${COLOR.button};">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:52px;v-text-anchor:middle;width:${width}px;" arcsize="16%" stroke="f" fillcolor="${COLOR.button}">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:19px;font-weight:bold;">${text}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${url}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:19px;line-height:22px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${COLOR.button};">${text}</a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>`;
};

const shortsHtml = (shorts: NonNullable<OnboardingEmail["shorts"]>) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
            <tr>${shorts
              .map(
                (short, index) => `
              <td width="50%" valign="top" align="${index === 0 ? "left" : "right"}" style="padding:0 ${index === 0 ? "6px" : "0"} 0 ${index === 0 ? "0" : "6px"};">
                <a href="${short.url}" target="_blank" style="text-decoration:none;"><img src="${short.image}" alt="${escapeHtml(short.alt)}" width="${short.width}" style="display:block;width:100%;max-width:${short.width}px;height:auto;border:0;outline:none;${TEXT_STYLE}"></a>
                <p style="margin:8px 0 0;font-family:${FONT};font-size:14px;line-height:20px;"><a href="${short.url}" target="_blank" style="color:${COLOR.link};text-decoration:underline;">${escapeHtml(short.label)}</a></p>
              </td>`
              )
              .join("")}
            </tr>
          </table>`;

// Keeps the opening lines of the body out of the inbox preview after the preheader.
const PREHEADER_SPACER = "&#847;&zwnj;&nbsp;".repeat(80);

export function renderTeacherOnboardingEmail(key: OnboardingEmailKey, ctx: OnboardingRenderContext) {
  const email = EMAILS(ctx)[key];
  const firstName = onboardingFirstName(ctx.displayName);
  const greeting = `Hi ${firstName ?? "there"},`;

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(email.subject)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>body,table,td,p,a,li,strong{font-family:Arial,sans-serif !important;}</style>
<![endif]-->
<style>
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  img { -ms-interpolation-mode:bicubic; }
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
  @media only screen and (max-width:620px) {
    .tk-wrap { padding:16px 16px 28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;" bgcolor="#ffffff">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">${escapeHtml(email.preheader)}${PREHEADER_SPACER}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">
    <tr>
      <td align="center" class="tk-wrap" style="padding:24px 16px 32px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 0 28px;">
              <a href="${email.hero.link.url}" target="_blank" style="text-decoration:none;"><img src="${email.hero.image}" alt="${escapeHtml(email.hero.alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;${TEXT_STYLE}"></a>
            </td>
          </tr>
          <tr>
            <td style="text-align:left;">
          ${paragraphHtml(escapeHtml(greeting))}
          ${email.paragraphs.map((value) => paragraphHtml(inlineHtml(value))).join("\n          ")}
          ${bulletsHtml(email.bullets)}
          ${buttonHtml(email.cta.label, email.cta.url)}
          ${email.shorts ? shortsHtml(email.shorts) : ""}
          ${paragraphHtml("Warm regards,")}
          ${paragraphHtml(`<strong style="font-weight:700;">Shivangi</strong>,<br>Product Marketing Lead<br>Testkart`, 0)}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid ${COLOR.rule};padding:16px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${COLOR.muted};">
                    You are getting this because you signed up to teach on Testkart. <a href="${ctx.unsubscribeUrl}" target="_blank" style="color:${COLOR.muted};text-decoration:underline;">Unsubscribe from these emails</a>.<br>
                    Testkart &middot; <a href="${SITE_URL}" target="_blank" style="color:${COLOR.muted};text-decoration:underline;">testkart.in</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    greeting,
    email.hero.link.video ? `Watch the video: ${email.hero.link.url}` : null,
    ...email.paragraphs.map(inlineText),
    email.bullets.map((item) => `- ${inlineText(item)}`).join("\n"),
    `${email.cta.label}: ${email.cta.url}`,
    email.shorts ? email.shorts.map((short) => `${short.label}: ${short.url}`).join("\n") : null,
    "Warm regards,\nShivangi\nProduct Marketing Lead\nTestkart",
    `Unsubscribe from these emails: ${ctx.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: email.subject, html, text };
}
