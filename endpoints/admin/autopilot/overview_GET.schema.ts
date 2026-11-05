import { z } from "zod";
import superjson from "superjson";
import type { AutopilotDashboard } from "../../../helpers/autopilotDashboardData";

export const schema = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value)).default(30),
});

export type InputType = z.input<typeof schema>;

export type OutputType = AutopilotDashboard;

export const getAdminAutopilotOverview = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const search = new URLSearchParams();
  if (params.days !== undefined) search.set("days", String(params.days));
  const result = await fetch(`/_api/admin/autopilot/overview?${search.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (body as object)) {
    throw new Error((body as { error?: string }).error ?? "Could not load the autopilot figures");
  }
  return body as OutputType;
};