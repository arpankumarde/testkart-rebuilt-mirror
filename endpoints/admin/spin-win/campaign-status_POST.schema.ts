import { z } from "zod";
import type { AdminSpinCampaign } from "../../../helpers/spinWinAdmin";
import { spinAdminFetch } from "../../../helpers/spinWinAdminFetch";

export const SPIN_STATUS_ACTIONS = ["publish", "pause", "resume", "complete", "unpublish"] as const;

export const schema = z.object({
  id: z.number().int().positive(),
  action: z.enum(SPIN_STATUS_ACTIONS),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { campaign: AdminSpinCampaign };

export const postAdminSpinCampaignStatus = (body: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>("campaign-status", schema.parse(body), init);