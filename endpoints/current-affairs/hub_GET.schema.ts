import { z } from "zod";
import superjson from "superjson";
import type { CurrentAffairsContentType, CurrentAffairsLanguage, CurrentAffairsTagKind } from "../../helpers/schema";

export const schema = z.object({
  lang: z.enum(["en", "hi"]).optional(),
});

export type InputType = z.infer<typeof schema>;

/** A published post as the public listing shows it; drafts never reach this shape. */
export type PublicDigestCard = {
  id: number;
  title: string;
  slug: string;
  contentType: CurrentAffairsContentType;
  language: CurrentAffairsLanguage;
  summary: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  /** The cover, else the share image, else the first news item's image; null when the digest has none. */
  thumbnailUrl: string | null;
  digestDate: string | null;
  publishedAt: Date | null;
  readingTimeMinutes: number;
  itemCount: number;
  authorName: string | null;
  /** Only set when the quiz itself is switched on for the site. */
  quizQuestionCount: number | null;
  tags: { kind: CurrentAffairsTagKind; name: string; slug: string; examId: number | null }[];
};

export type OutputType = {
  /** The newest daily digest, for the hero. */
  latestDaily: PublicDigestCard | null;
  /** The next most recent daily digests after the hero. */
  daily: PublicDigestCard[];
  /** The newest posts of every type, newest period first; the page leaves out the featured one. */
  latest: PublicDigestCard[];
  editorials: PublicDigestCard[];
  weekly: PublicDigestCard | null;
  monthly: PublicDigestCard | null;
  /** The newest post with a live quiz, daily first. */
  quiz: PublicDigestCard | null;
};

export const getCurrentAffairsHub = async (input: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.lang) params.set("lang", input.lang);
  const result = await fetch(`/_api/current-affairs/hub?${params.toString()}`, {
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