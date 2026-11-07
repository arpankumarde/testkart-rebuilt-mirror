import { WAPLIFY_ENDPOINT } from "./_publicConfigs";

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
 * count like email clicks. The _v2 names are Meta's; the plain first versions
 * were deleted on 15-11-2026 and those names cannot be reused.
 */

export type TemplateSlot = "first" | "followup" | "offer";

export type AutopilotWhatsAppTemplate = {
  playbookKey: string;
  slots: TemplateSlot[];
  name: string;
  category: "MARKETING" | "UTILITY";
  /** Plain-text heading line above the body (Meta allows up to 60 characters). */
  header: string;
  body: string;
  examples: string[];
  button: string;
};

const STOP_FOOTER = "Reply STOP to stop these messages";

export const AUTOPILOT_WHATSAPP_TEMPLATES: AutopilotWhatsAppTemplate[] = [
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
    AUTOPILOT_WHATSAPP_TEMPLATES.find((t) => t.playbookKey === key && t.slots.includes("first"))!.name,
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
 * configured first-message names are trusted.
 */
export function resolveTemplate(
  playbookKey: string,
  slot: TemplateSlot,
  approved: Set<string> | null,
  overrides: Record<string, string>
): string | null {
  const configured = overrides[playbookKey];
  if (!approved) return slot === "offer" ? null : configured ?? null;
  const override = configured && !BY_NAME.has(configured) ? configured : null;
  const candidates = [
    ...(slot !== "offer" && override ? [override] : []),
    ...AUTOPILOT_WHATSAPP_TEMPLATES.filter((t) => t.playbookKey === playbookKey && t.slots.includes(slot)).map((t) => t.name),
  ];
  const found = candidates.find((name) => approved.has(name));
  if (found) return found;
  return slot === "followup" ? resolveTemplate(playbookKey, "first", approved, overrides) : null;
}

async function waplify(path: string, init: RequestInit = {}): Promise<Response> {
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
  body: string;
  button: string;
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
      header: t.header,
      body: t.body,
      button: t.button,
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
        header: { format: "TEXT", text: template.header },
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
        ],
      }),
    });
    const text = await response.text();
    results.push({ name: template.name, result: response.ok ? "submitted to Meta" : `failed ${response.status}: ${text.slice(0, 200)}` });
  }
  return results;
}
