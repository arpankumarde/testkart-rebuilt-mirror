// Student emails that used to be rows of the email_templates table. They now
// live in code and render through the student layout; nothing here is read
// from the database or editable in the admin panel.
// {{placeholders}} are filled from the values the caller passes.
import { getBrandedEmailHtml, type BrandedEmailOptions } from "./emailBaseTemplate";

export type StudentTemplateEmail = {
  key: string;
  subject: string;
  text: string;
  options: Omit<BrandedEmailOptions, "title" | "studentAppPromo">;
};

const WALLET_URL = "https://testkart.in/student/wallet";

export const STUDENT_TEMPLATE_EMAILS: StudentTemplateEmail[] = [
  {
    key: "welcome_student",
    subject: "Welcome to Testkart, {{displayName}}",
    text: "Welcome to Testkart, {{displayName}}. Your account is ready. Pick your exam and take a mock test: https://testkart.in/student/dashboard",
    options: {
      preheaderText: "Your account is ready. Pick your exam and take a mock test.",
      eyebrow: "Welcome",
      heading: "Welcome, {{displayName}}",
      bodyHtml: `<p style="margin:0 0 12px;">Your Testkart account is ready.</p><p style="margin:0;">Pick your exam, take a mock test and see where you stand.</p>`,
      ctaLabel: "Go to my dashboard",
      ctaUrl: "https://testkart.in/student/dashboard",
    },
  },
  {
    key: "live_test_reminder",
    subject: "Starting soon: {{testName}}",
    text: 'Hi {{studentName}}, "{{testName}}" starts at {{scheduledDate}}. Log in 10 minutes early: https://testkart.in/mock-test/live/{{liveTestId}}',
    options: {
      preheaderText: "Starts at {{scheduledDate}}. Log in 10 minutes early.",
      eyebrow: "Live test",
      tone: "mint",
      heading: "Your live test starts soon",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{studentName}},</p><p style="margin:0;"><strong>{{testName}}</strong> is about to begin. Log in 10 minutes early so you're ready when it starts.</p>`,
      table: [{ label: "Starts", value: "{{scheduledDate}}", emphasize: true }],
      ctaLabel: "Go to the live test",
      ctaUrl: "https://testkart.in/mock-test/live/{{liveTestId}}",
    },
  },
  {
    key: "live_test_results",
    subject: "Your results are ready: {{testName}}",
    text: 'Hi {{studentName}}, the results for "{{testName}}" are out. See them at https://testkart.in/mock-test/live/{{liveTestId}}',
    options: {
      preheaderText: "The results are out. See how you did.",
      eyebrow: "Results",
      accent: "success",
      heading: "Your results are ready",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{studentName}},</p><p style="margin:0;">The results for <strong>{{testName}}</strong> are out. See how you did.</p>`,
      ctaLabel: "View my results",
      ctaUrl: "https://testkart.in/mock-test/live/{{liveTestId}}",
    },
  },
  {
    key: "review_reminder",
    subject: "How was {{itemName}}?",
    text: 'Hi {{studentName}}, how was "{{itemName}}" by {{teacherName}}? Leave a quick review: {{reviewLink}}',
    options: {
      preheaderText: "A quick review helps other students choose well.",
      eyebrow: "Your review",
      tone: "butter",
      heading: "How was it?",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{studentName}},</p><p style="margin:0;">You recently got <strong>{{itemName}}</strong> by {{teacherName}}. A quick review helps other students choose well.</p>`,
      ctaLabel: "Leave a review",
      ctaUrl: "{{reviewLink}}",
    },
  },
  {
    key: "student_bank_details_verified",
    subject: "Your bank details are verified",
    text: `Hi {{displayName}}, your bank details are verified. You can now withdraw money from your wallet: ${WALLET_URL}`,
    options: {
      eyebrow: "Verified",
      accent: "success",
      heading: "Your bank details are verified",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{displayName}},</p><p style="margin:0;">You can now withdraw money from your wallet.</p>`,
      ctaLabel: "Go to my wallet",
      ctaUrl: WALLET_URL,
    },
  },
  {
    key: "student_bank_details_rejected",
    subject: "Your bank details need a fix",
    text: `Hi {{displayName}}, we could not verify your bank details. Reason: {{reason}}. Please check them and submit again: ${WALLET_URL}`,
    options: {
      eyebrow: "Action needed",
      accent: "warning",
      heading: "We could not verify your bank details",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{displayName}},</p><p style="margin:0;">Please check your bank details and submit them again.</p>`,
      table: [{ label: "Reason", value: "{{reason}}" }],
      ctaLabel: "Update bank details",
      ctaUrl: WALLET_URL,
    },
  },
  {
    key: "student_withdrawal_requested",
    subject: "We got your withdrawal request",
    text: "Hi {{displayName}}, we received your request to withdraw ₹{{amount}}. It will be processed in 2-3 business days.",
    options: {
      eyebrow: "Withdrawal",
      tone: "blue",
      heading: "Withdrawal request received",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{displayName}},</p><p style="margin:0;">We've received your request to withdraw <strong>₹{{amount}}</strong>. It will be processed in 2-3 business days.</p>`,
      ctaLabel: "View my wallet",
      ctaUrl: WALLET_URL,
    },
  },
  {
    key: "wallet_credit_received",
    subject: "₹{{amount}} added to your wallet",
    text: "Hi {{displayName}}, ₹{{amount}} was added to your wallet. Reason: {{reason}}.",
    options: {
      eyebrow: "Wallet",
      accent: "success",
      heading: "₹{{amount}} added to your wallet",
      bodyHtml: `<p style="margin:0;">Hi {{displayName}}, money has been added to your Testkart wallet.</p>`,
      table: [
        { label: "Amount", value: "₹{{amount}}", emphasize: true },
        { label: "For", value: "{{reason}}" },
      ],
      ctaLabel: "View my wallet",
      ctaUrl: WALLET_URL,
    },
  },
  {
    key: "account_suspended",
    subject: "Your Testkart account has been {{actionPast}}",
    text: "Hi {{displayName}}, {{statusLine}} Reason: {{reasonText}} While your account is {{actionPast}}, you cannot sign in or open your purchases. Account Suspension Policy: https://testkart.in/account-suspension. To appeal, email ham@testkart.in from the email address on your account within 30 days.",
    options: {
      eyebrow: "Account",
      accent: "danger",
      heading: "{{actionTitle}}",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{displayName}},</p><p style="margin:0;">{{statusLine}}</p>`,
      table: [{ label: "Reason", value: "{{reason}}" }],
      afterCtaHtml: `<p style="margin:0 0 12px;">While your account is {{actionPast}}, you cannot sign in or open your purchases. Our <a href="https://testkart.in/account-suspension" style="color:#21283B;font-weight:600;">Account Suspension Policy</a> explains what happens to your purchases, Tcoins and wallet balance.</p><p style="margin:0;">To appeal, email <a href="mailto:ham@testkart.in" style="color:#21283B;font-weight:600;">ham@testkart.in</a> from the email address on your account within 30 days. Tell us why the decision should change and include any evidence.</p>`,
    },
  },
  {
    key: "account_reactivated",
    subject: "Your Testkart account is active again",
    text: "Hi {{displayName}}, your Testkart account has been reactivated. Log in at https://testkart.in/login",
    options: {
      eyebrow: "Account",
      accent: "success",
      heading: "Your account is active again",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{displayName}},</p><p style="margin:0;">Your Testkart account has been reactivated. Welcome back.</p>`,
      ctaLabel: "Log in",
      ctaUrl: "https://testkart.in/login",
    },
  },
  {
    key: "account_closure_confirmation",
    subject: "Your Testkart account has been closed",
    text: "Hi {{displayName}}, your Testkart account has been closed. Contact support@testkart.in within 30 days if this was a mistake.",
    options: {
      eyebrow: "Account",
      tone: "blue",
      heading: "Your account is closed",
      bodyHtml: `<p style="margin:0 0 12px;">Hi {{displayName}},</p><p style="margin:0;">Your Testkart account has been closed. If this was a mistake, write to support@testkart.in within 30 days.</p>`,
    },
  },
];

const fillPlaceholders = (value: string, placeholders: Record<string, string>): string =>
  value.replace(/{{(\w+)}}/g, (whole, name: string) => placeholders[name] ?? whole);

/** Returns null when the key has no student version, so the caller can fall back. */
export const renderStudentTemplateEmail = (
  key: string,
  placeholders: Record<string, string>
): { subject: string; html: string; text: string } | null => {
  const template = STUDENT_TEMPLATE_EMAILS.find((entry) => entry.key === key);
  if (!template) return null;
  const html = getBrandedEmailHtml({ ...template.options, title: template.subject, studentAppPromo: true });
  return {
    subject: fillPlaceholders(template.subject, placeholders),
    html: fillPlaceholders(html, placeholders),
    text: fillPlaceholders(template.text, placeholders),
  };
};
