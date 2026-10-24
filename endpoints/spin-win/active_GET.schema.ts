import { z } from "zod";
import superjson from "superjson";
import type { OutputType as CampaignView } from "./campaign_GET.schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

/** The campaign running now as the visitor sees it, or null when none is live. */
export type OutputType = { active: CampaignView | null };

export const getSpinWinActive = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/spin-win/active`, {
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