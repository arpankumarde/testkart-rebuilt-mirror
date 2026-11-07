import { z } from "zod";
import superjson from "superjson";
import type { AutopilotJourney } from "../../../helpers/autopilotJourneyData";

export const schema = z.object({
  userId: z.coerce.number().int().positive(),
});

export type InputType = z.input<typeof schema>;

export type OutputType = AutopilotJourney;

export const getAdminAutopilotJourney = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/autopilot/journey?userId=${encodeURIComponent(String(params.userId))}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (body as object)) throw new Error((body as { error?: string }).error ?? "Could not load the journey");
  return body as OutputType;
};