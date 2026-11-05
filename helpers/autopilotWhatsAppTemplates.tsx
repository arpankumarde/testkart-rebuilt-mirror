import { WAPLIFY_ENDPOINT } from "./_publicConfigs";

/**
 * The autopilot's WhatsApp templates, one per playbook, created on Waplify
 * (which submits them to Meta for approval) from the Autopilot page. Body
 * variables: {{1}} first name, {{2}} the item or exam. The button opens the
 * tracked link https://testkart.in/_api/go?c=<code>, so WhatsApp clicks count
 * like email clicks. Only a playbook's first step goes out on WhatsApp.
 */

export type AutopilotWhatsAppTemplate = {
  playbookKey: string;
  name: string;
  body: string;
  examples: [string, string];
  button: string;
};

export const AUTOPILOT_WHATSAPP_TEMPLATES: AutopilotWhatsAppTemplate[] = [
  {
    playbookKey: "failed_payment",
    name: "tk_payment_retry",
    body: "Hi {{1}}, your payment for {{2}} did not go through, so no money was taken. Your order is saved and you can complete it in under a minute.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "Complete my order",
  },
  {
    playbookKey: "cart_abandoned",
    name: "tk_cart_reminder",
    body: "Hi {{1}}, {{2}} is still in your Testkart cart. Checkout takes under a minute with UPI.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "Go to my cart",
  },
  {
    playbookKey: "onboarding",
    name: "tk_free_mock_start",
    body: "Hi {{1}}, welcome to Testkart! Your free mock test for {{2}} is ready. You see your score and every solution as soon as you submit.",
    examples: ["Priya", "SSC CGL"],
    button: "Take the free test",
  },
  {
    playbookKey: "free_to_paid",
    name: "tk_full_series",
    body: "Hi {{1}}, good work on your free test! The full {{2}} has more papers at the same level, with solutions and your rank on each.",
    examples: ["Priya", "SSC CGL Full Mock Test Series"],
    button: "See the full series",
  },
  {
    playbookKey: "repeat_purchase",
    name: "tk_more_practice",
    body: "Hi {{1}}, students preparing for the same exam as you also take {{2}}. Fresh papers and new questions.",
    examples: ["Priya", "RRB NTPC Mock Test Series"],
    button: "Have a look",
  },
];

export const DEFAULT_WHATSAPP_TEMPLATE_NAMES: Record<string, string> = Object.fromEntries(
  AUTOPILOT_WHATSAPP_TEMPLATES.map((t) => [t.playbookKey, t.name])
);

const BUTTON_URL = "https://testkart.in/_api/go?c={{1}}";

async function waplify(path: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = process.env.WAPLIFY_API_KEY;
  if (!apiKey) throw new Error("WAPLIFY_API_KEY is not set");
  return fetch(`${WAPLIFY_ENDPOINT}/api/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20000),
  });
}

export type TemplateStatus = { playbookKey: string; name: string; status: string };

/** Meta approval status of each autopilot template on Waplify ("MISSING" when not created yet). */
export async function listAutopilotTemplateStatuses(): Promise<TemplateStatus[]> {
  const response = await waplify("/templates/");
  if (!response.ok) throw new Error(`Waplify answered ${response.status}`);
  const payload = (await response.json()) as { templates?: { name?: string; status?: string }[] };
  const byName = new Map((payload.templates ?? []).map((t) => [t.name ?? "", (t.status ?? "UNKNOWN").toUpperCase()]));
  return AUTOPILOT_WHATSAPP_TEMPLATES.map((t) => ({ playbookKey: t.playbookKey, name: t.name, status: byName.get(t.name) ?? "MISSING" }));
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
        category: "MARKETING",
        language: "en",
        body: { text: template.body, examples: { "1": template.examples[0], "2": template.examples[1] } },
        footer: { text: "Reply STOP to stop these messages" },
        buttons: [
          { type: "URL", text: template.button, url: BUTTON_URL, url_example: "https://testkart.in/_api/go?c=Ab12Cd34" },
        ],
      }),
    });
    const text = await response.text();
    results.push({ name: template.name, result: response.ok ? "submitted to Meta" : `failed ${response.status}: ${text.slice(0, 200)}` });
  }
  return results;
}