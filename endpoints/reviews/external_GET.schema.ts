import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

/** Where the reviews come from. The link is always shown so a visitor can read the originals. */
export const REVIEWS_SOURCE = {
  name: "AmbitionBox",
  url: "https://www.ambitionbox.com/overview/testkart-overview?utm_source=employer-dashboard&utm_campaign=testkart&utm_medium=badges",
} as const;

/** The ratings badges AmbitionBox issues to Testkart as an employer. They are
    pictures, shown as issued and linked to REVIEWS_SOURCE.url. The detailed one
    is the main visual; the compact one replaces it on narrow screens. */
export const REVIEWS_BADGE = {
  src: "https://employer.ambitionbox.com/api/badge/2108566?badge-type=ratings-detailed",
  width: 612,
  height: 272,
  alt: "Testkart detailed ratings on AmbitionBox",
} as const;

export const REVIEWS_BADGE_COMPACT = {
  src: "https://employer.ambitionbox.com/api/badge/2108566?badge-type=ratings",
  width: 454,
  height: 246,
  alt: "Testkart ratings on AmbitionBox",
} as const;

export type ExternalReview = {
  id: string;
  title: string | null;
  /** A short excerpt or summary, never the full review. */
  excerpt: string;
  /** 1 to 5, null when the source shows no rating for this review. */
  rating: number | null;
  /** Designation or experience as the source publishes it, null when not public. */
  reviewerLabel: string | null;
  postedOn: Date | null;
  /** Deep link to this review on the source, null falls back to the source page. */
  url: string | null;
  /** Category tags the source attaches to this review, empty when it shows none. */
  tags: string[];
};

export type OutputType = {
  source: typeof REVIEWS_SOURCE;
  /** Overall rating and count exactly as the source states them, null when not verified. */
  summary: { rating: number; reviewCount: number } | null;
  /** Category scores out of 5 as the source publishes them. Empty when none are verified. */
  categories: { label: string; value: number }[];
  /** ISO date (YYYY-MM-DD) the summary and category scores were read from the source, null when there are none. */
  asOf: string | null;
  reviews: ExternalReview[];
};

export const getExternalReviews = async (
  _params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/reviews/external`, {
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
