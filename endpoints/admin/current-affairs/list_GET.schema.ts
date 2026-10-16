import { z } from "zod";
import superjson from "superjson";
import type {
  CurrentAffairsContentType,
  CurrentAffairsLanguage,
  CurrentAffairsStatus,
  CurrentAffairsTagKind,
} from "../../../helpers/schema";

export const schema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
  contentType: z
    .enum(["daily_digest", "editorial_analysis", "weekly_digest", "monthly_digest", "individual_item"])
    .optional(),
  topicId: z.number().int().positive().optional(),
  examId: z.number().int().positive().optional(),
  /** IST calendar days, inclusive; matched against the publish time, or the created time while undated. */
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type InputType = z.input<typeof schema>;

export type CurrentAffairsListRow = {
  id: number;
  title: string;
  slug: string;
  contentType: CurrentAffairsContentType;
  status: CurrentAffairsStatus;
  language: CurrentAffairsLanguage;
  coverImageUrl: string | null;
  authorName: string | null;
  publishAt: Date | null;
  publishedAt: Date | null;
  digestDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  quiz: { questionCount: number; isPublished: boolean } | null;
  tags: { kind: CurrentAffairsTagKind; name: string }[];
};

export type OutputType = {
  rows: CurrentAffairsListRow[];
  total: number;
  totalPages: number;
  /** Per status, under every filter except status itself, for the tab counts. */
  statusCounts: Record<CurrentAffairsStatus, number>;
};

export const getAdminCurrentAffairsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") params.append(key, String(value));
  }
  const result = await fetch(`/_api/admin/current-affairs/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};