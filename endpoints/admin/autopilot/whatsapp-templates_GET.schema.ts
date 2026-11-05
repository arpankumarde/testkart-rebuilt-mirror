import { z } from "zod";
import superjson from "superjson";
import type { TemplateStatus } from "../../../helpers/autopilotWhatsAppTemplates";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;
export type OutputType = { templates: TemplateStatus[] };

export const getAdminAutopilotWhatsAppTemplates = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/autopilot/whatsapp-templates`, { method: "GET", ...init });
  const body = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (body as object)) throw new Error((body as { error?: string }).error ?? "Could not load templates");
  return body as OutputType;
};