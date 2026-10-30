import { z } from "zod";
import type { GecAdminMeta, GecAdminRow, GecAdminTab } from "../../../helpers/gecServer";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({
  tab: z.enum(["all", "next30", "upsc", "ssc", "banking", "railway", "state", "open", "concluded"]).default("all"),
  search: z.string().trim().max(120).optional(),
  category: z.enum(["upsc", "ssc", "banking", "railway", "state", "central"]).optional(),
  status: z.enum(["open", "upcoming", "in_progress", "concluded", "tba", "tentative", "revised", "extended"]).optional(),
  verification: z.enum(["unverified", "verified", "needs_update"]).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(5).max(100).default(25),
});

export type InputType = z.input<typeof schema>;

export type OutputType = {
  rows: GecAdminRow[];
  total: number;
  totalPages: number;
  tabCounts: Record<GecAdminTab, number>;
  stats: {
    total: number;
    upcoming: number;
    openApplications: number;
    tba: number;
    recentlyConcluded: number;
    needsVerification: number;
  };
  years: string[];
  meta: GecAdminMeta;
};

export const getAdminGecList = (input: InputType, init?: RequestInit) =>
  gecGet<OutputType>("admin/govt-exams-calendar/list", input as Record<string, string | number | undefined>, init);