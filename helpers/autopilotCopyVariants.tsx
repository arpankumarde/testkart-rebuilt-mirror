import { sql } from "kysely";
import { db } from "./db";
import { AUTOPILOT_PLAYBOOKS, type Playbook, type PlaybookContext, type StepCopy } from "./autopilotPlaybooks";
import type { VariantStats } from "./autopilotRules";
import { autopilotAiText } from "./autopilotAi";

/**
 * Autopilot email copy beyond the built-in a/b versions in helpers/autopilotPlaybooks.
 * An admin asks the AI (helpers/autopilotAi) for drafts of one playbook step, edits
 * and approves them; an approved draft goes live as variant key v<id> and joins the
 * step's Thompson sampling. A step keeps at most two live versions so each comparison
 * gets enough sends, and at least one. Built-in a or b is retired by a rev_copy_variants
 * row with source 'builtin'. Drafts are templates: {name}, {item}, {amount}, {exam} and,
 * on offer steps, {offer} (the Tcoins line) are filled in at send time, so the AI never
 * writes an offer, a price or a promise itself. WhatsApp copy is not drafted here: it
 * needs Meta-approved templates (helpers/autopilotWhatsAppTemplates).
 */

export const MAX_LIVE_PER_STEP = 2;
export const COPY_EXAMPLES_KEY = "rev_autopilot_copy_examples";

export type CopyTemplate = { subject: string; heading: string; body: string; cta: string };

export const COPY_LIMITS = { subject: 90, heading: 80, body: 420, cta: 30 } as const;

const PLAYBOOK_BRIEFS: Record<string, string> = {
  failed_payment:
    "The student tried to pay for an order and the payment failed or was cancelled; no money was taken and the order is saved. Goal: they retry and pay.",
  cart_abandoned: "The student added a test series or notes to their cart and has not checked out. Goal: they check out.",
  onboarding:
    "A new student signed up but has not attempted any test yet. Goal: they attempt a first free mock test. Nothing is sold in this playbook.",
  free_to_paid: "The student finished the free paper of a paid test series. Goal: they buy the full series.",
  repeat_purchase:
    "The student bought a test series 3 days ago. This suggests another popular series for the same exam. Goal: a second purchase.",
};

const playbookPlaceholders = (playbookKey: string): string[] =>
  playbookKey === "onboarding" ? ["name", "exam"] : ["name", "item", "amount"];

export const allowedPlaceholders = (playbookKey: string, offerStep: boolean): string[] =>
  offerStep ? [...playbookPlaceholders(playbookKey), "offer"] : playbookPlaceholders(playbookKey);

const PLAYBOOKS = new Map(AUTOPILOT_PLAYBOOKS.map((playbook) => [playbook.key, playbook]));

export function stepOf(playbookKey: string, step: number): { playbook: Playbook; offer: boolean } | null {
  const playbook = PLAYBOOKS.get(playbookKey);
  const found = playbook?.steps[step - 1];
  return playbook && found ? { playbook, offer: found.offer === true } : null;
}

const inr = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;

export const offerLine = (coins: number, expireOn: string) =>
  coins > 0 ? `We've added ${coins} Tcoins to your account, usable on this order at checkout until ${expireOn}.` : "";

export function renderCopy(template: CopyTemplate, ctx: PlaybookContext, coins: number, coinsExpireOn: string): StepCopy {
  const values: Record<string, string> = {
    name: ctx.firstName || "there",
    item: ctx.itemTitle || ctx.examName || "your exam prep",
    amount: inr(ctx.amount),
    exam: ctx.examName || "your exam",
    offer: offerLine(coins, coinsExpireOn),
  };
  const fill = (text: string) =>
    text
      .replace(/\{(name|item|amount|exam|offer)\}/g, (_, key: string) => values[key])
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  return { subject: fill(template.subject), heading: fill(template.heading), body: fill(template.body), cta: fill(template.cta) };
}

const FAKE_URGENCY = /\b(hurry|last chance|only today|today only|ends tonight|expires tonight|limited (seats|time|period)|few seats|act now|don'?t miss out|guarantee[ds]?|100 ?%)\b/i;
const MONEY_WORDS = /(discount|cashback|coupon|promo code|% ?off|\boff\b on|\bcash\b|tcoin|\bcoins?\b)/i;
const PICTOGRAPH = /\p{Extended_Pictographic}/u;

export const cleanCopyText = (text: string) =>
  text
    .replace(/—|–/g, " - ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s*\n+\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

/** Problems with a draft for a step, empty when it can go live. */
export function validateCopy(template: CopyTemplate, playbookKey: string, offerStep: boolean): string[] {
  const problems: string[] = [];
  const allowed = new Set(allowedPlaceholders(playbookKey, offerStep));
  for (const field of ["subject", "heading", "body", "cta"] as const) {
    const text = template[field] ?? "";
    const label = field === "cta" ? "Button" : field[0].toUpperCase() + field.slice(1);
    if (!text.trim()) {
      problems.push(`${label} is empty`);
      continue;
    }
    if (text.length > COPY_LIMITS[field]) problems.push(`${label} is longer than ${COPY_LIMITS[field]} characters`);
    for (const match of text.matchAll(/\{([^{}]*)\}/g)) {
      if (!allowed.has(match[1])) problems.push(`${label} uses {${match[1]}}, which this step cannot fill`);
    }
    if (field !== "body" && text.includes("{offer}")) problems.push(`{offer} belongs in the body only`);
    if (/https?:\/\/|www\./i.test(text)) problems.push(`${label} has a link; the button carries the link`);
    if (PICTOGRAPH.test(text)) problems.push(`${label} has an emoji`);
    if (FAKE_URGENCY.test(text)) problems.push(`${label} uses pressure words (hurry, last chance, guaranteed and similar)`);
    if (MONEY_WORDS.test(text.replace(/\{offer\}/g, ""))) problems.push(`${label} promises money or coins; only {offer} may mention the offer`);
  }
  if (offerStep && !template.body.includes("{offer}")) problems.push("Body must include {offer} on this step, so the student learns about the Tcoins");
  return [...new Set(problems)];
}

export type CopyRow = {
  id: number;
  playbookKey: string;
  step: number;
  builtinKey: string | null;
  status: string;
  source: string;
  subject: string | null;
  heading: string | null;
  body: string | null;
  cta: string | null;
  brief: string | null;
  aiModel: string | null;
  createdAt: Date;
  liveAt: Date | null;
};

export const customKey = (id: number) => `v${id}`;

export type CopyState = {
  /** Live variant keys per "playbook:step". */
  liveKeys: (playbookKey: string, step: number) => string[];
  /** The copy for a variant key, also for retired custom versions (rescues of older sends). */
  copyFor: (playbook: Playbook, step: number, key: string, ctx: PlaybookContext, coins: number, coinsExpireOn: string) => StepCopy;
};

/** What the engine needs from the variants table for one pass. */
export async function loadCopyState(): Promise<CopyState> {
  const rows = (await db
    .selectFrom("revCopyVariants")
    .selectAll()
    .where("status", "in", ["live", "retired"])
    .execute()) as unknown as CopyRow[];
  const retiredBuiltins = new Set(
    rows.filter((r) => r.source === "builtin" && r.status === "retired").map((r) => `${r.playbookKey}:${r.step}:${r.builtinKey}`)
  );
  const customs = new Map(rows.filter((r) => r.source !== "builtin").map((r) => [customKey(r.id), r]));
  const liveCustoms = rows.filter((r) => r.source !== "builtin" && r.status === "live");

  const liveKeys = (playbookKey: string, step: number) => {
    const keys = ["a", "b"].filter((k) => !retiredBuiltins.has(`${playbookKey}:${step}:${k}`));
    for (const row of liveCustoms) if (row.playbookKey === playbookKey && row.step === step) keys.push(customKey(row.id));
    return keys.length > 0 ? keys : ["a"];
  };

  const copyFor: CopyState["copyFor"] = (playbook, step, key, ctx, coins, coinsExpireOn) => {
    const custom = customs.get(key);
    if (custom && custom.playbookKey === playbook.key && custom.step === step) {
      return renderCopy(
        { subject: custom.subject ?? "", heading: custom.heading ?? "", body: custom.body ?? "", cta: custom.cta ?? "" },
        ctx,
        coins,
        coinsExpireOn
      );
    }
    const variants = playbook.steps[step - 1].variants;
    return (key === "b" ? variants.b : variants.a)(ctx, coins, coinsExpireOn);
  };

  return { liveKeys, copyFor };
}

/** Paid-within-72-hours conversions per sent variant over the last 90 days, keyed "playbook:step". */
export async function variantStats(): Promise<Map<string, VariantStats[]>> {
  const rows = await sql<Record<string, unknown>>`
    SELECT m.playbook_key, m.step, m.variant_key,
      count(*)::int AS sends,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM orders o WHERE o.user_id = m.user_id AND o.status = 'completed' AND o.total_amount > 0
          AND o.created_at >= m.sent_at AND o.created_at < m.sent_at + interval '72 hours'))::int AS conversions
    FROM rev_messages m
    WHERE m.shadow = false AND m.sent_at IS NOT NULL AND m.variant_key IS NOT NULL
      AND m.sent_at > now() - interval '90 days'
    GROUP BY 1, 2, 3
  `.execute(db);
  const get = (row: Record<string, unknown>, snake: string) =>
    snake in row ? row[snake] : row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
  const stats = new Map<string, VariantStats[]>();
  for (const row of rows.rows) {
    const key = `${get(row, "playbook_key")}:${Number(get(row, "step"))}`;
    const list = stats.get(key) ?? [];
    list.push({ key: String(get(row, "variant_key")), sends: Number(get(row, "sends")) || 0, conversions: Number(get(row, "conversions")) || 0 });
    stats.set(key, list);
  }
  return stats;
}

/** Every live key of the step with its stats; keys never sent start at zero so they still get picked. */
export const statsForLiveKeys = (keys: string[], stats: VariantStats[] | undefined): VariantStats[] =>
  keys.map((key) => stats?.find((s) => s.key === key) ?? { key, sends: 0, conversions: 0 });

export async function getCopyExamples(): Promise<string[]> {
  const row = await db.selectFrom("platformSettings").select("settingValue").where("settingKey", "=", COPY_EXAMPLES_KEY).executeTakeFirst();
  try {
    const parsed = JSON.parse(row?.settingValue ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export const SAMPLE_EXPIRY = "14 Dec 2026";

export const sampleContext = (playbookKey: string): PlaybookContext =>
  playbookKey === "onboarding"
    ? { firstName: "Priya", itemTitle: "", amount: 0, examName: "SSC CGL" }
    : { firstName: "Priya", itemTitle: "SSC CGL Full Mock Test Series", amount: 99 };

const delayLabel = (minutes: number) =>
  minutes < 60 ? `${minutes} minutes` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} hours` : `${Math.round(minutes / 1440)} days`;

function parseDrafts(text: string): CopyTemplate[] {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        subject: cleanCopyText(String(item.subject ?? "")),
        heading: cleanCopyText(String(item.heading ?? "")),
        body: cleanCopyText(String(item.body ?? "")),
        cta: cleanCopyText(String(item.cta ?? "")),
      }));
  } catch {
    return [];
  }
}

export type DraftResult = { saved: number[]; rejected: { copy: CopyTemplate; problems: string[] }[]; model: string; provider: string };

/**
 * Asks the AI for `count` new versions of one step, checks each against the rules and
 * saves the ones that pass as drafts. The prompt carries the step's purpose, its live
 * versions with their results, the admin's proven messages and an optional brief.
 */
export async function draftCopyVariants(params: {
  playbookKey: string;
  step: number;
  count: number;
  brief: string | null;
  adminId: number;
}): Promise<DraftResult> {
  const found = stepOf(params.playbookKey, params.step);
  if (!found) throw new Error("That playbook step does not exist");
  const { playbook, offer } = found;
  const stepDef = playbook.steps[params.step - 1];
  const [state, stats, examples] = await Promise.all([loadCopyState(), variantStats(), getCopyExamples()]);
  const live = statsForLiveKeys(state.liveKeys(playbook.key, params.step), stats.get(`${playbook.key}:${params.step}`));
  const sample = sampleContext(playbook.key);
  const liveText = live
    .map((v) => {
      const copy = state.copyFor(playbook, params.step, v.key, sample, offer ? 40 : 0, SAMPLE_EXPIRY);
      const rate = v.sends > 0 ? `${Math.round((v.conversions / v.sends) * 1000) / 10}% paid within 72 hours of ${v.sends} sends` : "not sent yet";
      return `- Subject: ${copy.subject}\n  Heading: ${copy.heading}\n  Body: ${copy.body}\n  Button: ${copy.cta}\n  Result: ${rate}`;
    })
    .join("\n");
  const placeholders = allowedPlaceholders(playbook.key, offer);
  const placeholderHelp: Record<string, string> = {
    name: "{name}: the student's first name",
    item: "{item}: the test series or product title",
    amount: "{amount}: the price, written like Rs 99",
    exam: "{exam}: the exam they chose, like SSC CGL",
    offer: "{offer}: a full sentence saying how many Tcoins we added and until when (body only, required)",
  };

  const instructions = [
    "You write email copy for Testkart, an Indian exam-prep marketplace for government job aspirants (SSC, Railway, Banking, Teaching, Defence, state exams).",
    "Readers are students, many in small towns, often on a phone. Use plain, warm English; short sentences; no jargon.",
    "Rules: no emojis, no links, no fake urgency or pressure (hurry, last chance, only today, limited seats, guaranteed), no prices or discounts or coins except through the placeholders, never claim facts you were not given (ranks, numbers of students, results).",
    "Use hyphens, never long dashes. The email has a heading, one short body paragraph and a button; the button opens the right page.",
    `Placeholders you may use, written exactly with braces: ${placeholders.map((p) => placeholderHelp[p]).join("; ")}. No other braces.`,
    offer
      ? "Never mention Tcoins, coins, rewards or the offer anywhere except through {offer}: when the day's offer budget is used up {offer} is left empty, so the subject, heading and the rest of the body must stay true and read well without it."
      : "",
    `Limits: subject ${COPY_LIMITS.subject} characters, heading ${COPY_LIMITS.heading}, body ${COPY_LIMITS.body}, button ${COPY_LIMITS.cta}.`,
    `Answer with only a JSON array of ${params.count} objects with the keys subject, heading, body, cta. Each must try a clearly different angle from the others and from the live versions.`,
  ]
    .filter(Boolean)
    .join("\n");

  const input = [
    `Playbook: ${playbook.label}. ${PLAYBOOK_BRIEFS[playbook.key] ?? ""}`,
    `This is message ${params.step} of ${playbook.steps.length}, sent about ${delayLabel(stepDef.delayMinutes)} after the trigger.${offer ? " This message carries the Tcoins offer through {offer}." : " This message carries no offer."}`,
    `Live versions now (shown with sample values Priya, ${sample.itemTitle || sample.examName}):\n${liveText}`,
    examples.length > 0
      ? `Messages that worked well for us before (match their tone and directness, not their exact words; some are WhatsApp messages):\n${examples
          .slice(0, 20)
          .map((e) => `- ${e.slice(0, 1000)}`)
          .join("\n")}`
      : "",
    params.brief ? `What the admin wants to try: ${params.brief}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const ai = await autopilotAiText({ instructions, input, maxOutputTokens: 600 + params.count * 350 });
  const drafts = parseDrafts(ai.text).slice(0, params.count);
  if (drafts.length === 0) throw new Error("The AI answer could not be read. Try again.");

  const saved: number[] = [];
  const rejected: DraftResult["rejected"] = [];
  for (const copy of drafts) {
    const problems = validateCopy(copy, playbook.key, offer);
    if (problems.length > 0) {
      rejected.push({ copy, problems });
      continue;
    }
    const row = await db
      .insertInto("revCopyVariants")
      .values({
        playbookKey: playbook.key,
        step: params.step,
        status: "draft",
        source: "ai",
        ...copy,
        brief: params.brief,
        aiModel: `${ai.provider}:${ai.model}`,
        createdByAdminId: params.adminId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    saved.push(row.id);
  }
  return { saved, rejected, model: ai.model, provider: ai.provider };
}
