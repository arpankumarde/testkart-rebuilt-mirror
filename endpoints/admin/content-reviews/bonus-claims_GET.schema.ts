import { z } from "zod";
import superjson from "superjson";
import type {
  CampaignClaimStatus,
  CampaignContentType,
  CampaignCriteria,
  CampaignRequirements,
} from "../../../helpers/teacherCampaignRules";

export const BONUS_CLAIM_FILTERS = ["claimed", "credited", "declined", "reversed", "withdrawn", "all"] as const;
export type BonusClaimFilter = (typeof BONUS_CLAIM_FILTERS)[number];

export const schema = z.object({
  status: z.enum(BONUS_CLAIM_FILTERS).default("claimed"),
  page: z.coerce.number().int().positive().default(1),
});

export type InputType = z.input<typeof schema>;

export type BonusClaimAdminView = {
  id: number;
  status: CampaignClaimStatus;
  amount: number;
  contentType: CampaignContentType;
  contentId: number;
  contentTitle: string;
  live: boolean;
  teacherId: number;
  teacherName: string;
  teacherEmail: string | null;
  reviewStatus: string | null;
  criteriaAtClaim: CampaignCriteria;
  /** Measured now, for open claims only. */
  criteriaNow: CampaignCriteria | null;
  /** Whether criteriaNow meets the campaign rules. */
  meetsNow: boolean | null;
  requirements: CampaignRequirements;
  slots: { credited: number; limit: number };
  decisionNote: string | null;
  reverseReason: string | null;
  decidedByName: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  reversedAt: Date | null;
};

export type OutputType = {
  claims: BonusClaimAdminView[];
  counts: Record<"claimed" | "credited" | "declined" | "reversed", number>;
  creditedTotal: number;
  totalPages: number;
  currentPage: number;
};

export const getAdminBonusClaims = async (params: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  const result = await fetch(`/_api/admin/content-reviews/bonus-claims?${query.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};