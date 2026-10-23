import { z } from "zod";
import superjson from "superjson";
import type { InputType as SaveInput } from "../admin/current-affairs/save_POST.schema";
import type { CurrentAffairsStatus } from "../../helpers/schema";
import type { ArchiveType } from "../../helpers/currentAffairsMeta";

/** With a type, the last segment of /current-affairs/{type}/{slug}; without one, an older post's slug. */
export const schema = z.object({
  slug: z.string().min(1).max(255),
  type: z.enum(["daily", "weekly", "monthly"]).optional(),
});

export type InputType = z.infer<typeof schema>;

/** A published digest in the shape the article renderer takes, without admin-only fields. */
export type PublicDigestDetail = Omit<SaveInput, "status"> & {
  status: CurrentAffairsStatus;
  id: number;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
  related: { id: number; title: string; slug: string; path: string }[];
};

export type OutputType = {
  post: PublicDigestDetail;
  /** Where the post lives now; pages redirect here when the requested URL is an older one. */
  canonicalPath: string;
  /** The listing the page sits under; null for older post types. */
  archive: ArchiveType | null;
  /** On a story's own page, the digest it came from. */
  digest: { title: string; path: string; storyCount: number; hasQuiz: boolean } | null;
  relatedArticles: PublicRelatedArticle[];
};

export type PublicRelatedArticle = {
  id: number;
  title: string;
  href: string;
  imageUrl: string | null;
  dateLabel: string;
};

export const getCurrentAffairsDetails = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value) params.set(key, value);
  }
  const result = await fetch(`/_api/current-affairs/details?${params.toString()}`, {
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