import { z } from "zod";
import superjson from "superjson";
import type { PublicDigestCard } from "./hub_GET.schema";

export const PUBLIC_LIST_TYPES = ["daily", "editorials", "weekly", "monthly", "quiz"] as const;
export type PublicListType = (typeof PUBLIC_LIST_TYPES)[number];

export const schema = z.object({
  type: z.enum(PUBLIC_LIST_TYPES).optional(),
  /** Tag slugs, e.g. "polity" or "upsc-cse". */
  topic: z.string().max(120).optional(),
  exam: z.string().max(120).optional(),
  lang: z.enum(["en", "hi"]).optional(),
  page: z.number().int().min(1).max(500).default(1),
});

export type InputType = z.input<typeof schema>;

export type OutputType = {
  rows: PublicDigestCard[];
  total: number;
  totalPages: number;
  /** Display names for the topic and exam slugs asked for, when they exist. */
  topicName: string | null;
  examName: string | null;
};

export const getCurrentAffairsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const result = await fetch(`/_api/current-affairs/list?${params.toString()}`, {
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