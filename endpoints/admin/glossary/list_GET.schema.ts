import { z } from "zod";
import superjson from "superjson";
import { GLOSSARY_CATEGORY_VALUES, GLOSSARY_STATUS_VALUES } from "../../../helpers/glossaryMeta";
import type { GlossaryCategory, GlossaryTermStatus } from "../../../helpers/schema";

export const schema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.enum(GLOSSARY_CATEGORY_VALUES).optional(),
  status: z.enum(GLOSSARY_STATUS_VALUES).optional(),
  sort: z.enum(["recent", "alphabetical"]).default("recent"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type InputType = z.input<typeof schema>;
export type ParsedInput = z.output<typeof schema>;

export type GlossaryListRow = {
  id: number;
  term: string;
  slug: string;
  category: GlossaryCategory;
  definition: string;
  status: GlossaryTermStatus;
  updatedAt: Date;
  /** How many of its related terms are published, so show on its public page. */
  liveRelatedCount: number;
  /** How many other terms list this one as related. */
  usedByCount: number;
};

export type GlossaryStats = {
  total: number;
  published: number;
  draft: number;
  /** Terms changed in the last seven days. */
  recentlyUpdated: number;
};

export type OutputType = {
  rows: GlossaryListRow[];
  total: number;
  totalPages: number;
  /** Across the whole glossary, whatever the filters. */
  stats: GlossaryStats;
};

export const getAdminGlossaryList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") params.append(key, String(value));
  }
  const result = await fetch(`/_api/admin/glossary/list?${params.toString()}`, {
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