import { z } from "zod";
import type { AdminSpinCampaign, AdminSpinReward } from "../../../helpers/spinWinAdmin";
import { spinAdminFetch, spinQuery } from "../../../helpers/spinWinAdminFetch";

export const schema = z.object({
  id: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type AdminSpinAuditEntry = {
  id: string;
  adminName: string | null;
  entity: string;
  entityId: string | null;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

export type OutputType = {
  campaign: AdminSpinCampaign;
  rewards: AdminSpinReward[];
  probabilityTotal: number;
  /** What blocks publishing or resuming; empty when the wheel is valid. */
  problems: string[];
  spins: number;
  audit: AdminSpinAuditEntry[];
};

export const getAdminSpinCampaign = (params: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>(`campaign${spinQuery(schema.parse(params))}`, undefined, init);