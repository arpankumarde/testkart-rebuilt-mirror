import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;
export type OutputType = { results: { name: string; result: string }[] };

export const postAdminAutopilotWhatsAppTemplates = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/autopilot/whatsapp-templates`, {
    method: "POST",
    body: superjson.stringify({}),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (body as object)) throw new Error((body as { error?: string }).error ?? "Could not create templates");
  return body as OutputType;
};