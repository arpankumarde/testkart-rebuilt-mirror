import { z } from "zod";
import type { AdminSpinReward } from "../../../helpers/spinWinAdmin";
import { SPIN_REWARD_TYPES } from "../../../helpers/spinWinRules";
import { spinAdminFetch } from "../../../helpers/spinWinAdminFetch";

export const SPIN_REWARD_ICONS = ["percent", "ticket", "gift", "star", "sparkles", "trophy", "crown", "flame"] as const;

const money = z.number().nonnegative().max(1_000_000).nullable();

export const schema = z.object({
  id: z.number().int().positive().optional(),
  campaignId: z.number().int().positive(),
  name: z.string().trim().min(1, "Name is required").max(80),
  rewardType: z.enum(SPIN_REWARD_TYPES),
  description: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .transform((v) => (v ? v : null)),
  discountType: z.enum(["percentage", "flat"]).nullable(),
  discountValue: z.number().positive().max(1_000_000).nullable(),
  wheelLabel: z.string().trim().min(1, "Wheel label is required").max(20, "Keep wheel labels to 20 characters"),
  segmentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex colour like #FFD9C7"),
  icon: z.enum(SPIN_REWARD_ICONS).nullable(),
  imageUrl: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .transform((v) => (v ? v : null)),
  probability: z.number().min(0).max(100).multipleOf(0.001, "Use at most 3 decimal places"),
  minOrderValue: money,
  maxDiscountAmount: z.number().positive().max(1_000_000).nullable(),
  quantityLimit: z.number().int().nonnegative().nullable(),
  activatesAt: z.coerce.date().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export type InputType = z.input<typeof schema>;
export type OutputType = { reward: AdminSpinReward };

export const postAdminSpinRewardSave = (body: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>("reward-save", schema.parse(body), init);