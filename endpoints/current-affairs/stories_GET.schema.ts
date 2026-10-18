import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  lang: z.enum(["en", "hi"]).optional(),
  /** A topic tag slug; only stories tagged with it are listed. */
  topic: z.string().max(120).optional(),
  page: z.number().int().min(1).max(500).default(1),
});

export type InputType = z.input<typeof schema>;

/** One news item from a published daily digest, listed on its own. */
export type PublicDailyStory = {
  id: number;
  headline: string;
  /** "Why in news", else the start of the key points as plain text. */
  summary: string;
  /** The item's own image, else the digest's cover; null when neither exists. */
  thumbnailUrl: string | null;
  digestTitle: string;
  digestDate: string | null;
  publishedAt: Date | null;
  language: "en" | "hi";
  /** The digest's page with the story's section as the hash. */
  href: string;
  tags: { name: string; slug: string }[];
};

export type OutputType = { rows: PublicDailyStory[]; total: number; totalPages: number };

export const getCurrentAffairsStories = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const result = await fetch(`/_api/current-affairs/stories?${params.toString()}`, {
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