import { WAPLIFY_ENDPOINT } from "./_publicConfigs";
import type { PlaybookContext } from "./autopilotPlaybooks";

/**
 * The autopilot's WhatsApp templates, created on Waplify (which submits them
 * to Meta for approval) from the Autopilot page. Each has a heading line,
 * *bold* key words and short paragraphs, and serves one or more slots of a
 * playbook: "first" (the playbook's first message), "followup" (later messages
 * without an offer, for people with no usable email) and "offer" (the step
 * that grants Tcoins, so the message can say how many and until when). For a
 * slot, the first APPROVED template in this list wins; followup falls back to
 * first. Body variables: {{1}} first name, {{2}} the item or exam, and on
 * offer templates {{3}} the Tcoins and {{4}} their last day. The button opens
 * the tracked link https://testkart.in/_api/go?c=<code>, so WhatsApp clicks
 * count like email clicks. The _v3 versions (20-11-2026) carry an image header
 * (the item's own thumbnail at send time, else the playbook image under
 * cdn.testkart.in/platform/marketing/whatsapp/) and quick-reply buttons that
 * helpers/autopilotQuickReplies acts on; they sit above the _v2 text-header
 * versions, which keep sending until Meta approves the _v3 ones. The plain
 * first versions were deleted on 15-11-2026 and those names cannot be reused.
 * Two UTILITY templates come first in their slot: tk_account_ready (welcome,
 * needs the student's exam) and tk_test_result (their free paper's score and
 * rank, button to their own result page). They carry no selling, so Meta keeps
 * them utility, which skips the per-person marketing limits; a student whose
 * context lacks their values gets the marketing template instead.
 */

export type TemplateSlot = "first" | "followup" | "offer";

/** Quick-reply buttons: the tapped button's text is all the webhook receives, so the text is the key. */
export const QUICK_REPLIES = {
  help: "Payment problem",
  later: "Remind me tomorrow",
  stop: "Not interested",
} as const;

export type QuickReplyAction = keyof typeof QUICK_REPLIES;

export const quickReplyAction = (text: string): QuickReplyAction | null => {
  const clean = text.trim().toLowerCase();
  const found = (Object.keys(QUICK_REPLIES) as QuickReplyAction[]).find((key) => QUICK_REPLIES[key].toLowerCase() === clean);
  return found ?? null;
};

/** What each body variable holds, in order; the playbook context must carry every one a template needs. */
export type TemplateVar = "name" | "item" | "exam" | "coins" | "expiry" | "paper" | "score" | "rank";

const DEFAULT_VARS: TemplateVar[] = ["name", "item", "coins", "expiry"];

export type AutopilotWhatsAppTemplate = {
  playbookKey: string;
  slots: TemplateSlot[];
  name: string;
  category: "MARKETING" | "UTILITY";
  /** Plain-text heading line above the body (Meta allows up to 60 characters); unused when headerImage is set. */
  header: string;
  /** Image header: the sample Meta reviews and the image sent when the item has no usable thumbnail. */
  headerImage?: string;
  body: string;
  examples: string[];
  button: string;
  quickReplies?: QuickReplyAction[];
  /** Body variables in order; defaults to name, item, Tcoins, expiry (cut to the body's count). */
  vars?: TemplateVar[];
  /** Where the button opens, when it is not the playbook's own link. */
  linkPath?: (ctx: PlaybookContext) => string | null;
};

/** Utility templates: messages about the student's own account or test attempt, with no selling in them. */
const UTILITY_TEMPLATES: AutopilotWhatsAppTemplate[] = [
  {
    playbookKey: "onboarding",
    slots: ["first"],
    name: "tk_account_ready",
    category: "UTILITY",
    header: "Your account is ready",
    body: "Hi {{1}},\n\nYour Testkart account is ready and set up for *{{2}}*.\n\nYour tests are in your account. After each test you see your *score and full solutions*.",
    examples: ["Priya", "SSC CGL"],
    button: "Open Testkart",
    vars: ["name", "exam"],
  },
  {
    playbookKey: "free_to_paid",
    slots: ["first"],
    name: "tk_test_result",
    category: "UTILITY",
    header: "Your test result",
    body: "Hi {{1}},\n\nHere is your result for *{{2}}*:\n\nScore: *{{3}}*\nRank: *{{4}}*\n\nYour answers and full solutions are on your result page.",
    examples: ["Priya", "SSC CGL Mock Test 1", "62.5%", "120 of 900 students"],
    button: "See my result",
    vars: ["name", "paper", "score", "rank"],
    linkPath: (ctx) => (ctx.testItemId ? `/portal/${ctx.testItemId}/results` : null),
  },
];

const varValue = (key: TemplateVar, ctx: PlaybookContext, coins: number, coinsExpireOn: string): string | null => {
  switch (key) {
    case "name":
      return ctx.firstName || "there";
    case "item":
      return ctx.itemTitle || ctx.examName || "your exam";
    case "exam":
      return ctx.examName ?? null;
    case "coins":
      return String(coins);
    case "expiry":
      return coinsExpireOn;
    case "paper":
      return ctx.paperTitle ?? null;
    case "score":
      return ctx.scoreText ?? null;
    case "rank":
      return ctx.rankText ?? null;
  }
};

const varsOf = (name: string): TemplateVar[] => {
  const template = BY_NAME.get(name);
  return template?.vars ?? DEFAULT_VARS.slice(0, templateVariableCount(name));
};

/** False when the context lacks a value the template needs (for example an exam for the welcome message). */
export const templateUsable = (name: string, ctx: PlaybookContext): boolean =>
  varsOf(name).every((key) => varValue(key, ctx, 0, "") !== null);

/** The template's body values for one send. */
export const templateVariables = (name: string, ctx: PlaybookContext, coins: number, coinsExpireOn: string): string[] =>
  varsOf(name).map((key) => varValue(key, ctx, coins, coinsExpireOn) ?? "");

/** The template's own button target, or null to use the playbook's link. */
export const templateLinkPath = (name: string, ctx: PlaybookContext): string | null => BY_NAME.get(name)?.linkPath?.(ctx) ?? null;

const STOP_FOOTER = "Reply STOP to stop these messages";

const IMAGE_BASE = "https://cdn.testkart.in/platform/marketing/whatsapp";
export const WHATSAPP_HEADER_IMAGES = {
  payment: `${IMAGE_BASE}/payment.jpg`,
  cart: `${IMAGE_BASE}/cart.jpg`,
  freeMock: `${IMAGE_BASE}/free-mock.jpg`,
  series: `${IMAGE_BASE}/series.jpg`,
  morePractice: `${IMAGE_BASE}/more-practice.jpg`,
  tcoins: `${IMAGE_BASE}/tcoins.jpg`,
} as const;

/** The item's thumbnail when Meta can show it (JPEG or PNG on our CDN), else the template's own image. */
export function headerImageFor(templateName: string, itemImageUrl: string | null | undefined): string | null {
  const fallback = BY_NAME.get(templateName)?.headerImage ?? null;
  if (!fallback) return null;
  const url = (itemImageUrl ?? "").trim();
  return /^https:\/\/cdn\.testkart\.in\/[^?#]+\.(jpe?g|png)$/i.test(url) ? url : fallback;
}

const V3_TEMPLATES: AutopilotWhatsAppTemplate[] = [
  {
    playbookKey: "failed_payment",
    slots: ["first", "followup"],
    name: "tk_payment_failed_v3",
    category: "UTILITY",
    header: "Payment not completed",
    headerImage: WHATSAPP_HEADER_IMAGES.payment,
    body: "*Payment not completed*\n\nHi {{1}},\n\nYour payment for *{{2}}* did not go through and *no money was deducted*.\n\nYour order is saved, so you can retry the payment from the link below.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "Retry payment",
    quickReplies: ["help", "later"],
  },
  {
    playbookKey: "failed_payment",
    slots: ["offer"],
    name: "tk_payment_offer_v3",
    category: "MARKETING",
    header: "Your order is still open",
    headerImage: WHATSAPP_HEADER_IMAGES.tcoins,
    body: "*Your order is still open*\n\nHi {{1}},\n\nYour order for *{{2}}* is still waiting for you.\n\nWe have added *{{3}} Tcoins* to your Testkart account to use on it at checkout until *{{4}}*.\n\nTap below to finish your order.",
    examples: ["Priya", "SSC CGL Full Mock Test Series", "40", "14 Dec 2026"],
    button: "Complete my order",
    quickReplies: ["help", "stop"],
  },
  {
    playbookKey: "cart_abandoned",
    slots: ["first", "followup"],
    name: "tk_cart_reminder_v3",
    category: "MARKETING",
    header: "Your cart is saved",
    headerImage: WHATSAPP_HEADER_IMAGES.cart,
    body: "*Your cart is saved*\n\nHi {{1}},\n\n*{{2}}* is still in your Testkart cart.\n\nCheckout takes *under a minute* with UPI.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "Go to my cart",
    quickReplies: ["later", "stop"],
  },
  {
    playbookKey: "cart_abandoned",
    slots: ["offer"],
    name: "tk_cart_offer_v3",
    category: "MARKETING",
    header: "A little help for your cart",
    headerImage: WHATSAPP_HEADER_IMAGES.tcoins,
    body: "*A little help for your cart*\n\nHi {{1}},\n\n*{{2}}* is still in your cart, and we have added *{{3}} Tcoins* to your Testkart account to use on it.\n\nThey work at checkout until *{{4}}*. Tap below to see your cart.",
    examples: ["Priya", "SSC CGL Full Mock Test Series", "40", "14 Dec 2026"],
    button: "Use my Tcoins",
    quickReplies: ["help", "stop"],
  },
  {
    playbookKey: "onboarding",
    slots: ["first"],
    name: "tk_free_mock_start_v3",
    category: "MARKETING",
    header: "Welcome to Testkart",
    headerImage: WHATSAPP_HEADER_IMAGES.freeMock,
    body: "*Welcome to Testkart*\n\nHi {{1}},\n\nYour *free mock test for {{2}}* is ready.\n\nYou see your *score and every solution* as soon as you submit.",
    examples: ["Priya", "SSC CGL"],
    button: "Take the free test",
    quickReplies: ["later", "stop"],
  },
  {
    playbookKey: "onboarding",
    slots: ["followup"],
    name: "tk_free_mock_nudge_v3",
    category: "MARKETING",
    header: "Your free test is waiting",
    headerImage: WHATSAPP_HEADER_IMAGES.freeMock,
    body: "*Your free test is waiting*\n\nHi {{1}},\n\nA *free mock test for {{2}}* is still waiting for you.\n\nIt takes about an hour, and you see your *score and every solution* right after you submit.",
    examples: ["Priya", "SSC CGL"],
    button: "Start the free test",
    quickReplies: ["later", "stop"],
  },
  {
    playbookKey: "free_to_paid",
    slots: ["first", "followup"],
    name: "tk_full_series_v3",
    category: "MARKETING",
    header: "Good work on your free test",
    headerImage: WHATSAPP_HEADER_IMAGES.series,
    body: "*Good work on your free test*\n\nHi {{1}},\n\nThe full *{{2}}* has more papers at the same level, each with *solutions and your rank*.\n\nPick up where your free paper stopped.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "See the full series",
    quickReplies: ["later", "stop"],
  },
  {
    playbookKey: "free_to_paid",
    slots: ["offer"],
    name: "tk_series_offer_v3",
    category: "MARKETING",
    header: "Ready for the full series?",
    headerImage: WHATSAPP_HEADER_IMAGES.tcoins,
    body: "*Ready for the full series?*\n\nHi {{1}},\n\nYou have already tried a paper from *{{2}}*. We have added *{{3}} Tcoins* to your Testkart account to use on it at checkout until *{{4}}*.\n\nTap below to see the series.",
    examples: ["Priya", "SSC CGL Full Mock Test Series", "40", "14 Dec 2026"],
    button: "Get the full series",
    quickReplies: ["help", "stop"],
  },
  {
    playbookKey: "repeat_purchase",
    slots: ["first", "followup"],
    name: "tk_more_practice_v3",
    category: "MARKETING",
    header: "More practice for your exam",
    headerImage: WHATSAPP_HEADER_IMAGES.morePractice,
    body: "*More practice for your exam*\n\nHi {{1}},\n\nStudents preparing for the same exam as you also take *{{2}}*.\n\n*Fresh papers and new questions*, so you are not repeating ones you have already seen.",
    examples: ["Priya", "RRB NTPC Mock Test Series"],
    button: "Have a look",
    quickReplies: ["later", "stop"],
  },
];

export const AUTOPILOT_WHATSAPP_TEMPLATES: AutopilotWhatsAppTemplate[] = [
  ...UTILITY_TEMPLATES,
  ...V3_TEMPLATES,
  {
    playbookKey: "failed_payment",
    slots: ["first", "followup"],
    name: "tk_payment_failed_v2",
    category: "UTILITY",
    header: "Payment not completed",
    body: "Hi {{1}},\n\nYour payment for *{{2}}* did not go through and *no money was deducted*.\n\nYour order is saved, so you can retry the payment from the link below.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "Retry payment",
  },
  {
    playbookKey: "failed_payment",
    slots: ["offer"],
    name: "tk_payment_offer_v2",
    category: "MARKETING",
    header: "Your order is still open",
    body: "Hi {{1}},\n\nYour order for *{{2}}* is still waiting for you.\n\nWe have added *{{3}} Tcoins* to your Testkart account to use on it at checkout until *{{4}}*.\n\nTap below to finish your order.",
    examples: ["Priya", "SSC CGL Full Mock Test Series", "40", "14 Dec 2026"],
    button: "Complete my order",
  },
  {
    playbookKey: "cart_abandoned",
    slots: ["first", "followup"],
    name: "tk_cart_reminder_v2",
    category: "MARKETING",
    header: "Your cart is saved",
    body: "Hi {{1}},\n\n*{{2}}* is still in your Testkart cart.\n\nCheckout takes *under a minute* with UPI.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "Go to my cart",
  },
  {
    playbookKey: "cart_abandoned",
    slots: ["offer"],
    name: "tk_cart_offer_v2",
    category: "MARKETING",
    header: "A little help for your cart",
    body: "Hi {{1}},\n\n*{{2}}* is still in your cart, and we have added *{{3}} Tcoins* to your Testkart account to use on it.\n\nThey work at checkout until *{{4}}*. Tap below to see your cart.",
    examples: ["Priya", "SSC CGL Full Mock Test Series", "40", "14 Dec 2026"],
    button: "Use my Tcoins",
  },
  {
    playbookKey: "onboarding",
    slots: ["first"],
    name: "tk_free_mock_start_v2",
    category: "MARKETING",
    header: "Welcome to Testkart",
    body: "Hi {{1}},\n\nYour *free mock test for {{2}}* is ready.\n\nYou see your *score and every solution* as soon as you submit.",
    examples: ["Priya", "SSC CGL"],
    button: "Take the free test",
  },
  {
    playbookKey: "onboarding",
    slots: ["followup"],
    name: "tk_free_mock_nudge_v2",
    category: "MARKETING",
    header: "Your free test is waiting",
    body: "Hi {{1}},\n\nA *free mock test for {{2}}* is still waiting for you.\n\nIt takes about an hour, and you see your *score and every solution* right after you submit.",
    examples: ["Priya", "SSC CGL"],
    button: "Start the free test",
  },
  {
    playbookKey: "free_to_paid",
    slots: ["first", "followup"],
    name: "tk_full_series_v2",
    category: "MARKETING",
    header: "Good work on your free test",
    body: "Hi {{1}},\n\nThe full *{{2}}* has more papers at the same level, each with *solutions and your rank*.\n\nPick up where your free paper stopped.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "See the full series",
  },
  {
    playbookKey: "free_to_paid",
    slots: ["offer"],
    name: "tk_series_offer_v2",
    category: "MARKETING",
    header: "Ready for the full series?",
    body: "Hi {{1}},\n\nYou have already tried a paper from *{{2}}*. We have added *{{3}} Tcoins* to your Testkart account to use on it at checkout until *{{4}}*.\n\nTap below to see the series.",
    examples: ["Priya", "SSC CGL Full Mock Test Series", "40", "14 Dec 2026"],
    button: "Get the full series",
  },
  {
    playbookKey: "repeat_purchase",
    slots: ["first", "followup"],
    name: "tk_more_practice_v2",
    category: "MARKETING",
    header: "More practice for your exam",
    body: "Hi {{1}},\n\nStudents preparing for the same exam as you also take *{{2}}*.\n\n*Fresh papers and new questions*, so you are not repeating ones you have already seen.",
    examples: ["Priya", "RRB NTPC Mock Test Series"],
    button: "Have a look",
  },
];

const BY_NAME = new Map(AUTOPILOT_WHATSAPP_TEMPLATES.map((t) => [t.name, t]));

/**
 * The first-message template per playbook, the default for
 * rev_autopilot.whatsappTemplates, which is used only when Waplify cannot be
 * asked which templates are approved.
 */
export const DEFAULT_WHATSAPP_TEMPLATE_NAMES: Record<string, string> = Object.fromEntries(
  [...new Set(AUTOPILOT_WHATSAPP_TEMPLATES.map((t) => t.playbookKey))].map((key) => [
    key,
    AUTOPILOT_WHATSAPP_TEMPLATES.find((t) => t.playbookKey === key && t.slots.includes("first") && !t.vars)!.name,
  ])
);

/** How many body variables a template takes; unknown names (a hand-set override) take the two base ones. */
export const templateVariableCount = (name: string): number => {
  const body = BY_NAME.get(name)?.body;
  return body ? (body.match(/\{\{\d+\}\}/g) ?? []).length : 2;
};

/**
 * The template for a playbook slot: the first approved one in the catalogue,
 * after a hand-set override (a name outside the catalogue) for the first and
 * followup slots. With no approval list (Waplify unreachable) only the
 * configured first-message names are trusted. `usable` skips catalogue
 * templates the person's context cannot fill (see templateUsable).
 */
export function resolveTemplate(
  playbookKey: string,
  slot: TemplateSlot,
  approved: Set<string> | null,
  overrides: Record<string, string>,
  usable: (name: string) => boolean = () => true
): string | null {
  const configured = overrides[playbookKey];
  if (!approved) return slot === "offer" ? null : configured ?? null;
  const override = configured && !BY_NAME.has(configured) ? configured : null;
  const candidates = [
    ...(slot !== "offer" && override ? [override] : []),
    ...AUTOPILOT_WHATSAPP_TEMPLATES.filter((t) => t.playbookKey === playbookKey && t.slots.includes(slot))
      .map((t) => t.name)
      .filter(usable),
  ];
  const found = candidates.find((name) => approved.has(name));
  if (found) return found;
  return slot === "followup" ? resolveTemplate(playbookKey, "first", approved, overrides, usable) : null;
}

export async function waplify(path: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = process.env.WAPLIFY_API_KEY;
  if (!apiKey) throw new Error("WAPLIFY_API_KEY is not set");
  return fetch(`${WAPLIFY_ENDPOINT}/api/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20000),
  });
}

export type TemplateStatus = {
  playbookKey: string;
  name: string;
  slots: TemplateSlot[];
  header: string | null;
  headerImage: string | null;
  body: string;
  button: string;
  quickReplies: string[];
  /** The category we asked for and the one Meta gave it (Meta can move a utility template to marketing). */
  category: string;
  metaCategory: string | null;
  status: string;
};

/** Meta approval status of each autopilot template on Waplify ("MISSING" when not created yet). */
export async function listAutopilotTemplateStatuses(): Promise<TemplateStatus[]> {
  const response = await waplify("/templates/");
  if (!response.ok) throw new Error(`Waplify answered ${response.status}`);
  const payload = (await response.json()) as { templates?: { name?: string; status?: string; category?: string }[] };
  const byName = new Map((payload.templates ?? []).map((t) => [t.name ?? "", t]));
  return AUTOPILOT_WHATSAPP_TEMPLATES.map((t) => {
    const live = byName.get(t.name);
    return {
      playbookKey: t.playbookKey,
      name: t.name,
      slots: t.slots,
      header: t.headerImage ? null : t.header,
      headerImage: t.headerImage ?? null,
      body: t.body,
      button: t.button,
      quickReplies: (t.quickReplies ?? []).map((key) => QUICK_REPLIES[key]),
      category: t.category,
      metaCategory: live?.category ? live.category.toUpperCase() : null,
      status: live ? (live.status ?? "UNKNOWN").toUpperCase() : "MISSING",
    };
  });
}

/** Names of the autopilot templates Meta has approved, or null when Waplify cannot be reached. */
export async function approvedTemplateNames(): Promise<Set<string> | null> {
  try {
    const statuses = await listAutopilotTemplateStatuses();
    return new Set(statuses.filter((s) => s.status === "APPROVED").map((s) => s.name));
  } catch (error) {
    console.warn("[autopilot] could not list WhatsApp templates:", error);
    return null;
  }
}

/** Creates the templates that do not exist yet on Waplify; existing ones are left alone. */
export async function createMissingAutopilotTemplates(): Promise<{ name: string; result: string }[]> {
  const statuses = await listAutopilotTemplateStatuses();
  const results: { name: string; result: string }[] = [];
  for (const template of AUTOPILOT_WHATSAPP_TEMPLATES) {
    if (statuses.find((s) => s.name === template.name)?.status !== "MISSING") {
      results.push({ name: template.name, result: "already exists" });
      continue;
    }
    const response = await waplify("/templates/create", {
      method: "POST",
      body: JSON.stringify({
        name: template.name,
        category: template.category,
        language: "en",
        ...(template.headerImage
          ? { header: { format: "IMAGE" }, media_url: template.headerImage }
          : { header: { format: "TEXT", text: template.header } }),
        body: {
          text: template.body,
          examples: Object.fromEntries(template.examples.map((value, index) => [String(index + 1), value])),
        },
        ...(template.category === "MARKETING" ? { footer: { text: STOP_FOOTER } } : {}),
        buttons: [
          {
            type: "URL",
            text: template.button,
            url: "https://testkart.in/_api/go?c={{1}}",
            url_example: "https://testkart.in/_api/go?c=Ab12Cd34",
          },
          ...(template.quickReplies ?? []).map((key) => ({ type: "QUICK_REPLY", text: QUICK_REPLIES[key] })),
        ],
      }),
    });
    const text = await response.text();
    results.push({ name: template.name, result: response.ok ? "submitted to Meta" : `failed ${response.status}: ${text.slice(0, 200)}` });
  }
  return results;
}
