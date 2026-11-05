import { z } from "zod";
import superjson from "superjson";

/** Only the switches an admin may flip. Caps, costs and the holdout salt change by migration. */
export const schema = z.object({
  enabled: z.boolean().optional(),
  shadow: z.boolean().optional(),
  aiProvider: z.enum(["deepseek", "floot"]).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { enabled: boolean; shadow: boolean; aiProvider: "deepseek" | "floot" };

export const postAdminAutopilotSettings = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/autopilot/settings`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const parsed = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (parsed as object)) {
    throw new Error((parsed as { error?: string }).error ?? "Could not save the autopilot settings");
  }
  return parsed as OutputType;
};