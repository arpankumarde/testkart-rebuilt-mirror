import { z } from "zod";
import type { AdminSpinCampaign } from "../../../helpers/spinWinAdmin";
import { SPIN_CATEGORIES, SPIN_MAX_DISCOUNT_PERCENT } from "../../../helpers/spinWinRules";
import { spinAdminFetch } from "../../../helpers/spinWinAdminFetch";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const schema = z
  .object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().min(3, "Name must be at least 3 characters").max(120),
    slug: z
      .string()
      .trim()
      .min(3, "Slug must be at least 3 characters")
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens"),
    description: optionalText(2000),
    bannerUrl: optionalText(1000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Unknown timezone"),
    terms: optionalText(20000),
    allowGuestSpins: z.boolean(),
    loginRequiredToSpin: z.boolean(),
    maxTotalSpins: z.number().int().positive().nullable(),
    claimDeadline: z.coerce.date().nullable(),
    redemptionDeadline: z.coerce.date().nullable(),
    eligibleCategories: z.array(z.enum(SPIN_CATEGORIES)).min(1, "Pick at least one eligible category"),
    maxDiscountPercent: z.number().positive().max(SPIN_MAX_DISCOUNT_PERCENT, `At most ${SPIN_MAX_DISCOUNT_PERCENT}%`),
    discountFunding: z.enum(["current_split", "platform_funded"]),
    popupEnabled: z.boolean().default(true),
    popupDelaySeconds: z.number().int().min(0).max(120).default(0),
    seedDiwaliPresets: z.boolean().optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "The end must be after the start", path: ["endsAt"] })
  .refine((v) => !v.claimDeadline || v.claimDeadline > v.startsAt, { message: "The claim deadline must be after the start", path: ["claimDeadline"] })
  .refine((v) => !v.redemptionDeadline || v.redemptionDeadline > v.startsAt, {
    message: "The redemption deadline must be after the start",
    path: ["redemptionDeadline"],
  })
  .refine((v) => !(v.loginRequiredToSpin && v.allowGuestSpins), {
    message: "Guests cannot spin when login is required to spin",
    path: ["allowGuestSpins"],
  });

export type InputType = z.input<typeof schema>;

export type OutputType = { campaign: AdminSpinCampaign };

export const postAdminSpinCampaignSave = (body: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>("campaign-save", schema.parse(body), init);