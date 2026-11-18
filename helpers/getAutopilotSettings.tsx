import { db } from "./db";
import type { RevChannel } from "./schema";
import { DEFAULT_WHATSAPP_TEMPLATE_NAMES } from "./autopilotWhatsAppTemplates";

export type AutopilotAiProvider = "deepseek" | "floot";

export type ChannelCostPaise = {
  email: number;
  whatsappMarketing: number;
  whatsappUtility: number;
  push: number;
  onsite: number;
};

/**
 * The revenue autopilot's settings, kept as JSON in platform_settings under
 * rev_autopilot and merged over safe defaults. Without a holdout salt the
 * autopilot is treated as off, since its impact could not be measured.
 * aiProvider picks the model behind the autopilot's own AI (helpers/autopilotAi):
 * our DeepSeek key by default, or Floot AI. Teacher and admin AI always use DeepSeek.
 */

export type AutopilotSettings = {
  enabled: boolean;
  shadow: boolean;
  holdoutPercent: number;
  holdoutSalt: string;
  dailyMessageCap: number;
  weeklyMessageCap: number;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  dailyOfferBudgetRupees: number;
  offerMarginShare: number;
  /** What one send costs us, in paise (fractions allowed). WhatsApp is priced by the template's Meta category. */
  channelCostPaise: ChannelCostPaise;
  /** When the measurement layer went live in production (set after publish); checks and coverage count from here. */
  trackingStartedAt: string | null;
  aiProvider: AutopilotAiProvider;
  /**
   * First-message Waplify template per playbook key, used only when Waplify cannot say which templates are
   * approved; a name outside the template catalogue is a hand-set override (helpers/autopilotWhatsAppTemplates).
   */
  whatsappTemplates: Record<string, string>;
  /** Days the Tcoins on a playbook's offer last, per playbook key; missing keys use DEFAULT_OFFER_EXPIRY_DAYS. */
  tcoinExpiryDays: Record<string, number>;
};

export const AUTOPILOT_SETTINGS_KEY = "rev_autopilot";

export const DEFAULT_OFFER_EXPIRY_DAYS = 30;

export const offerExpiryDays = (settings: AutopilotSettings, playbookKey: string): number =>
  settings.tcoinExpiryDays[playbookKey] ?? DEFAULT_OFFER_EXPIRY_DAYS;

export const DEFAULT_AUTOPILOT_SETTINGS: AutopilotSettings = {
  enabled: false,
  shadow: true,
  holdoutPercent: 10,
  holdoutSalt: "",
  dailyMessageCap: 1,
  weeklyMessageCap: 4,
  sendWindowStartHour: 9,
  sendWindowEndHour: 22,
  dailyOfferBudgetRupees: 500,
  offerMarginShare: 0.5,
  channelCostPaise: { email: 9.25, whatsappMarketing: 86.31, whatsappUtility: 11.5, push: 0, onsite: 0 },
  trackingStartedAt: null,
  aiProvider: "deepseek",
  whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATE_NAMES,
  tcoinExpiryDays: {},
};

const num = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeAutopilotSettings(raw: unknown): AutopilotSettings {
  const d = DEFAULT_AUTOPILOT_SETTINGS;
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const costs = v.channelCostPaise && typeof v.channelCostPaise === "object" ? (v.channelCostPaise as Record<string, unknown>) : {};
  const salt = typeof v.holdoutSalt === "string" ? v.holdoutSalt : "";
  const started =
    typeof v.trackingStartedAt === "string" && !Number.isNaN(Date.parse(v.trackingStartedAt)) ? v.trackingStartedAt : null;
  return {
    enabled: v.enabled === true && salt.length > 0,
    shadow: v.shadow !== false,
    holdoutPercent: num(v.holdoutPercent, d.holdoutPercent, 0, 50),
    holdoutSalt: salt,
    dailyMessageCap: num(v.dailyMessageCap, d.dailyMessageCap, 0, 5),
    weeklyMessageCap: num(v.weeklyMessageCap, d.weeklyMessageCap, 0, 14),
    sendWindowStartHour: num(v.sendWindowStartHour, d.sendWindowStartHour, 0, 23),
    sendWindowEndHour: num(v.sendWindowEndHour, d.sendWindowEndHour, 1, 24),
    dailyOfferBudgetRupees: num(v.dailyOfferBudgetRupees, d.dailyOfferBudgetRupees, 0, 100000),
    offerMarginShare: num(v.offerMarginShare, d.offerMarginShare, 0, 1),
    channelCostPaise: {
      email: num(costs.email, d.channelCostPaise.email, 0, 1000),
      whatsappMarketing: num(costs.whatsappMarketing, d.channelCostPaise.whatsappMarketing, 0, 1000),
      whatsappUtility: num(costs.whatsappUtility, d.channelCostPaise.whatsappUtility, 0, 1000),
      push: num(costs.push, d.channelCostPaise.push, 0, 1000),
      onsite: num(costs.onsite, d.channelCostPaise.onsite, 0, 1000),
    },
    trackingStartedAt: started,
    aiProvider: v.aiProvider === "floot" ? "floot" : "deepseek",
    whatsappTemplates: {
      ...DEFAULT_WHATSAPP_TEMPLATE_NAMES,
      ...Object.fromEntries(
        Object.entries(v.whatsappTemplates && typeof v.whatsappTemplates === "object" ? (v.whatsappTemplates as Record<string, unknown>) : {})
          .filter(([key, value]) => /^[a-z_]{1,40}$/.test(key) && typeof value === "string" && /^[a-z0-9_]{1,100}$/.test(value))
          .map(([key, value]) => [key, value as string])
      ),
    },
    tcoinExpiryDays: Object.fromEntries(
      Object.entries(v.tcoinExpiryDays && typeof v.tcoinExpiryDays === "object" ? (v.tcoinExpiryDays as Record<string, unknown>) : {})
        .filter(([key, value]) => /^[a-z_]{1,40}$/.test(key) && typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 365)
        .map(([key, value]) => [key, value as number])
    ),
  };
}

/** The cost of one send; a WhatsApp template is billed at Meta's utility or marketing rate. */
export const messageCostPaise = (
  settings: AutopilotSettings,
  channel: RevChannel,
  whatsappCategory: "MARKETING" | "UTILITY" = "MARKETING"
): number => {
  const costs = settings.channelCostPaise;
  if (channel === "whatsapp") return whatsappCategory === "UTILITY" ? costs.whatsappUtility : costs.whatsappMarketing;
  return costs[channel];
};

export async function getAutopilotSettings(): Promise<AutopilotSettings> {
  const row = await db
    .selectFrom("platformSettings")
    .select("settingValue")
    .where("settingKey", "=", AUTOPILOT_SETTINGS_KEY)
    .executeTakeFirst();
  if (!row?.settingValue) return DEFAULT_AUTOPILOT_SETTINGS;
  try {
    return normalizeAutopilotSettings(JSON.parse(row.settingValue));
  } catch {
    return DEFAULT_AUTOPILOT_SETTINGS;
  }
}