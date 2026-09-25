import { EMAIL_BRAND, getBrandedEmailHtml } from "./emailBaseTemplate";
import type { OnboardingEmailKey } from "./teacherOnboardingSchedule";

/**
 * Copy for the eight teacher onboarding emails (timing lives in
 * helpers/teacherOnboardingSchedule). No merge tags: every email opens with
 * "Namaste,". Every link carries the lifecycle UTMs with its own utm_content.
 *
 * Text uses a small markup: a paragraph or list item is a string, and
 * [label](url) inside it becomes a link. It renders to both HTML and plain text.
 */

export type OnboardingPlanRow = {
  name: string;
  price: number;
  platformFeePercentage: number;
};

export type OnboardingRenderContext = {
  published: boolean;
  /** Active monthly plans, cheapest first. Email 7 shows them. */
  plans: OnboardingPlanRow[];
  unsubscribeUrl: string;
};

type Block = { p: string } | { ol: string[] } | { ul: string[] } | { plans: true };

type OnboardingEmail = {
  subject: string;
  preheader: string;
  cta: { label: string; url: string };
  before: Block[];
  after: Block[];
};

const SITE_URL = "https://testkart.in";
const LINK_COLOR = "#903209";

const utm = (content: string) =>
  `utm_source=email&utm_medium=lifecycle&utm_campaign=teacher_onboarding&utm_content=${content}`;
const site = (path: string, content: string) => `${SITE_URL}${path}?${utm(content)}`;
const external = (url: string, content: string) => `${url}${url.includes("?") ? "&" : "?"}${utm(content)}`;

const EMAILS = (ctx: OnboardingRenderContext): Record<OnboardingEmailKey, OnboardingEmail> => ({
  e1: {
    subject: "Your Testkart account is ready",
    preheader: "Three things you can sell, starting today.",
    cta: { label: "Open my dashboard", url: site("/teacher/dashboard", "e1_dashboard_cta") },
    before: [
      { p: "Namaste," },
      { p: "Your teacher account on Testkart is live. It costs nothing to set up. You pay a platform fee only when a student buys." },
      { p: "You can sell three kinds of content here:" },
      {
        ol: [
          "Mock tests. Full test series or single papers, with timers and marks.",
          "Study notes and PDFs. Upload a file you already have and set a price.",
          "Courses. Video lessons in sections, like a recorded batch.",
        ],
      },
      { p: "You set the price for each one. Free works too, if you want students to try you first." },
      { p: "Your dashboard shows what to do first: finish your profile, then publish your first listing. The next few emails walk you through each step." },
    ],
    after: [
      {
        p: `Want to know who built Testkart and why? Watch our story (5 min, Hindi): [Testkart Ka Safar](${external("https://www.youtube.com/watch?v=XUTSQl5cgs0", "e1_story_video")})`,
      },
    ],
  },
  e2: {
    subject: "Students check this page before they buy",
    preheader: "It takes just 5 minutes to complete your profile.",
    cta: { label: "Finish my profile", url: site("/teacher/edit-profile", "e2_profile_cta") },
    before: [
      { p: "Namaste," },
      { p: "Every teacher on Testkart gets a public profile page. Students land there from your tests and notes. It is where they decide whether to trust you." },
      { p: "Most new profiles are missing two things:" },
      {
        ul: [
          'Tagline. One line on what you teach and for which exam. Example: "MP Patwari and ESB exam mock tests in Hindi."',
          "About you. Three or four lines. Years of teaching, exams you cover, results your students got.",
        ],
      },
      { p: "Add a clear photo too. JPG or PNG, square, at least 400 x 400 pixels and under 1 MB." },
      { p: "The profile page shows your profile strength and the next field to fill. Get it to 100% before you publish." },
    ],
    after: [],
  },
  e3: {
    subject: "Turn your question papers into a mock test",
    preheader: "Watch it done in 5 minutes.",
    cta: { label: "Create my first test series", url: site("/teacher/create-test", "e3_create_test_cta") },
    before: [
      { p: "Namaste," },
      { p: "Students want to practise under real exam conditions. A mock test gives them that. If you already have questions in Word or Excel, you are most of the way there." },
      { p: "How a test series works:" },
      {
        ol: [
          "Create the series and pick the exam.",
          "Add papers (test items) inside it.",
          "Add questions one by one, or upload them in bulk.",
          "Set timing, marks and price. Publish.",
        ],
      },
      { p: "Save questions to your Question Bank once, and reuse them in every future test." },
      {
        p: `Watch the full walkthrough (5 min): [How to Create a Test Series on Testkart](${external("https://www.youtube.com/watch?v=Jdz4LRGt2bQ", "e3_test_series_video")})`,
      },
    ],
    after: [
      { p: "Step-by-step guides if you get stuck:" },
      {
        ul: [
          `[How to Create a Test Series](${site("/help/how-to-create-a-test-series", "e3_help_create_test")})`,
          `[How to Add Questions to a Test Series](${site("/help/how-to-add-questions-to-test-series", "e3_help_add_questions")})`,
          `[How to Build a Question Bank](${site("/help/how-to-create-a-question-bank-on-testkart", "e3_help_question_bank")})`,
        ],
      },
    ],
  },
  e4: {
    subject: "Those notes on your laptop can earn",
    preheader: "Upload a PDF, set a price, done.",
    cta: { label: "Upload my first PDF", url: site("/teacher/products/create", "e4_create_pdf_cta") },
    before: [
      { p: "Namaste," },
      { p: "Handwritten notes, chapter summaries, previous-year solutions, formula sheets. If it is a PDF, you can sell it on Testkart." },
      {
        ol: [
          "Add a title, exam and description.",
          "Upload the file.",
          "Set a price, or make it free.",
          "Publish.",
        ],
      },
      { p: "A free PDF is a good first listing. Students read it, see your work, and come back for your paid tests." },
      {
        p: `Watch it done (3 min): [How to Create Notes & PDFs in Testkart](${external("https://www.youtube.com/watch?v=aQg3lFftXi8", "e4_notes_video")})`,
      },
    ],
    after: [
      {
        p: `Need to edit or take one down later? Watch [Manage your Notes & PDFs](${external("https://www.youtube.com/watch?v=kusMbHXDz9k", "e4_manage_notes_video")}) (2 min) or read [How to Create & Sell Notes and PDFs](${site("/help/how-to-create-sell-notes-and-pdfs", "e4_help_sell_notes")}).`,
      },
    ],
  },
  e5: {
    subject: "Run a live mock test on a fixed date",
    preheader: "Everyone starts at the same time.",
    cta: { label: "Schedule my first live test", url: site("/teacher/create-live-test", "e5_live_test_cta") },
    before: [
      { p: "Namaste," },
      { p: "A live test is a mock test with a start time. Every student sits the paper together, the way the real exam works." },
      { p: "Live tests show up on the Testkart homepage under Live Competitive Mock Tests, with a countdown to the start. Some teachers add a prize pool to pull in more students." },
      { p: "You build it the same way as a test series: subjects, sections, questions. Then you pick the date, the time and the entry fee." },
      {
        p: `Watch the full setup (6 min): [How to Create a Live Test in Testkart](${external("https://www.youtube.com/watch?v=Q4rLMYnTQAc", "e5_live_test_video")})`,
      },
    ],
    after: [
      { p: "More help:" },
      {
        ul: [
          `[How to Create & Publish a Live Test](${site("/help/how-to-create-and-publish-a-live-test", "e5_help_create_live_test")})`,
          `[How to Manage Questions in a Live Test](${site("/help/helpmanaging-questions-in-a-live-test", "e5_help_live_questions")})`,
          `[Editing a live test](${external("https://www.youtube.com/watch?v=mwWm7eHIx4Q", "e5_manage_live_test_video")}) (2 min video)`,
        ],
      },
    ],
  },
  e6: {
    subject: "Put your recorded classes on sale",
    preheader: "Sections, lessons, one price.",
    cta: { label: "Build my first course", url: site("/teacher/courses/create", "e6_create_course_cta") },
    before: [
      { p: "Namaste," },
      { p: "If you record your classes, you can sell them as a course. Students buy once and watch on mobile or desktop." },
      { p: "A course has three levels:" },
      {
        ul: [
          "Sections. Your chapters or units.",
          "Lessons. The individual classes inside each section.",
          "Content. The material students watch or read in each lesson.",
        ],
      },
      {
        p: `Already have tests and notes live? Group them into a [bundle](${site("/teacher/bundles/create", "e6_create_bundle_link")}) and sell the set at one price. A course, a test series and a notes PDF for one exam make a clean first bundle.`,
      },
    ],
    after: [
      { p: "Step-by-step guides:" },
      {
        ul: [
          `[How to Create & Publish a Course](${site("/help/how-to-create-and-publish-a-course", "e6_help_create_course")})`,
          `[How to Structure Your Course: Section, Lesson, Content](${site("/help/how-to-structure-course-sections-lessons-content", "e6_help_course_structure")})`,
          `[How to Edit a Course and Set Course Pricing](${site("/help/edit-course-and-set-course-pricing", "e6_help_course_pricing")})`,
        ],
      },
    ],
  },
  e7: {
    subject: "Add your bank account before your first sale",
    preheader: "And what Testkart keeps from each sale.",
    cta: { label: "Add my bank account", url: site("/teacher/earnings", "e7_bank_account_cta") },
    before: [
      { p: "Namaste," },
      { p: "When a student buys your test, notes or course, the money lands in your Testkart balance. To withdraw it, your bank account needs to be on file. Add it now so nothing waits when the first sale comes in. Open Earnings and click Bank account." },
      ...(ctx.plans.length > 0
        ? ([{ p: "What Testkart keeps from each sale depends on your plan:" }, { plans: true }] as Block[])
        : []),
      { p: "Start on Free. Move up when your sales make the lower fee worth it. Starter also adds a verified teacher badge and AI question generation." },
    ],
    after: [
      { p: "How payouts and plans work:" },
      {
        ul: [
          `[How to Add Bank Account](${external("https://youtu.be/u5QEBFyQqIM", "e7_bank_account_video")})`,
          `[How to Withdraw Money from Testkart](${site("/help/how-to-withdraw-money-from-testkart", "e7_help_withdrawal")})`,
          `[How to Manage Your Testkart Subscription](${site("/help/how-to-manage-testkart-subscription", "e7_help_subscription")})`,
          `[How to Set the Price of a Test Series](${site("/help/how-to-set-price-of-test-series", "e7_help_test_pricing")})`,
        ],
      },
    ],
  },
  e8: {
    subject: "Build your tests from ChatGPT or Claude",
    preheader: "Plus what other teachers say about Testkart.",
    cta: { label: "Connect my AI assistant", url: site("/teacher/dashboard", "e8_ai_assistant_cta") },
    before: [
      { p: "Namaste," },
      { p: "You can now connect your Testkart account to ChatGPT, Claude or Perplexity. Once connected, you ask in plain words and the assistant does the work in your account:" },
      {
        ul: [
          '"Write 20 questions on the Indian Constitution for my UPSC test."',
          '"How many sales did I make this week?"',
          '"Update the price of my Patwari test series to ₹199."',
        ],
      },
      { p: "Nothing changes until you sign in to Testkart and select Allow. You can disconnect any time." },
      {
        p: `Watch the setup (7 min): [How to Connect ChatGPT, Claude, or Perplexity to Your Testkart Account](${external("https://www.youtube.com/watch?v=GRzh-sJ2fJs", "e8_ai_setup_video")})`,
      },
    ],
    after: [
      {
        p: `Written guide: [Connect ChatGPT, Claude, or Perplexity to Testkart](${site("/help/connect-ai-assistant-testkart", "e8_help_ai_connection")})`,
      },
      {
        p: ctx.published
          ? "Hear from teachers already selling on Testkart:"
          : "Still deciding what to publish first? Hear from teachers already selling on Testkart:",
      },
      {
        ul: [
          `[What Teachers Say About Testkart](${external("https://www.youtube.com/shorts/1TtssJbN6mo", "e8_teacher_story_1")})`,
          `[Real Experiences with Testkart](${external("https://www.youtube.com/shorts/C_rlxVEm1cY", "e8_teacher_story_2")})`,
        ],
      },
      { p: "Reply to this email if something is blocking you." },
    ],
  },
});

const SIGN_OFF = "Team Testkart";
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inlineHtml = (value: string) =>
  escapeHtml(value).replace(
    LINK,
    (_match, label: string, url: string) =>
      `<a href="${url}" style="color:${LINK_COLOR};text-decoration:underline;font-weight:600;">${label}</a>`
  );

const inlineText = (value: string) => value.replace(LINK, (_match, label: string, url: string) => `${label} (${url})`);

const planPrice = (plan: OnboardingPlanRow) =>
  plan.price > 0 ? `₹${plan.price.toLocaleString("en-IN")} a month` : "₹0";
const planName = (plan: OnboardingPlanRow) => plan.name.replace(/\s+plan$/i, "");
const planFee = (plan: OnboardingPlanRow) => `${Number(plan.platformFeePercentage.toFixed(2))}%`;

const plansHtml = (plans: OnboardingPlanRow[]) => {
  const cell = (value: string, align: "left" | "right", header: boolean) =>
    `<${header ? "th" : "td"} style="text-align:${align};padding:10px 12px;border-bottom:${header ? "2px" : "1px"} solid ${EMAIL_BRAND.border};color:${EMAIL_BRAND.text};font-weight:${header ? "700" : "400"};">${escapeHtml(value)}</${header ? "th" : "td"}>`;
  const rows = plans
    .map((plan) => `<tr>${cell(planName(plan), "left", false)}${cell(planPrice(plan), "left", false)}${cell(planFee(plan), "right", false)}</tr>`)
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;font-size:14px;">
      <thead><tr>${cell("Plan", "left", true)}${cell("Price", "left", true)}${cell("Testkart keeps", "right", true)}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

const blocksHtml = (blocks: Block[], plans: OnboardingPlanRow[]) =>
  blocks
    .map((block) => {
      if ("p" in block) return `<p style="margin:0 0 16px;">${inlineHtml(block.p)}</p>`;
      if ("plans" in block) return plansHtml(plans);
      const tag = "ol" in block ? "ol" : "ul";
      const items = "ol" in block ? block.ol : block.ul;
      return `<${tag} style="margin:0 0 16px;padding-left:22px;">${items
        .map((item) => `<li style="margin:0 0 6px;">${inlineHtml(item)}</li>`)
        .join("")}</${tag}>`;
    })
    .join("");

const blocksText = (blocks: Block[], plans: OnboardingPlanRow[]) =>
  blocks
    .map((block) => {
      if ("p" in block) return inlineText(block.p);
      if ("plans" in block)
        return plans.map((plan) => `${planName(plan)}: ${planPrice(plan)}, Testkart keeps ${planFee(plan)} of each sale`).join("\n");
      if ("ol" in block) return block.ol.map((item, index) => `${index + 1}. ${inlineText(item)}`).join("\n");
      return block.ul.map((item) => `- ${inlineText(item)}`).join("\n");
    })
    .join("\n\n");

export function renderTeacherOnboardingEmail(key: OnboardingEmailKey, ctx: OnboardingRenderContext) {
  const email = EMAILS(ctx)[key];
  const after = email.after.length > 0 ? blocksHtml(email.after, ctx.plans) : "";
  const footerNote = `You are getting this because you signed up to teach on Testkart. <a href="${ctx.unsubscribeUrl}" style="color:${EMAIL_BRAND.muted};text-decoration:underline;">Unsubscribe from these emails</a>.`;

  const html = getBrandedEmailHtml({
    title: email.subject,
    preheaderText: email.preheader,
    bodyVariant: "plain",
    bodyHtml: blocksHtml(email.before, ctx.plans),
    ctaLabel: email.cta.label,
    ctaUrl: email.cta.url,
    ctaColor: LINK_COLOR,
    afterCtaHtml: `${after}<p style="margin:0;">${SIGN_OFF}</p>`,
    footerNote,
  });

  const text = [
    blocksText(email.before, ctx.plans),
    `${email.cta.label}: ${email.cta.url}`,
    email.after.length > 0 ? blocksText(email.after, ctx.plans) : null,
    SIGN_OFF,
    `Unsubscribe from these emails: ${ctx.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: email.subject, html, text };
}
