import { z } from "zod";
import superjson from "superjson";
import type { AutopilotOperations } from "../../../helpers/autopilotOperationsData";

export const schema = z.object({});

export type InputType = z.input<typeof schema>;

export type OutputType = AutopilotOperations;

export const getAdminAutopilotOperations = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/autopilot/operations`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (body as object)) {
    throw new Error((body as { error?: string }).error ?? "Could not load the autopilot operations");
  }
  return body as OutputType;
};