import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { listAutopilotTemplateStatuses } from "../../../helpers/autopilotWhatsAppTemplates";
import { OutputType } from "./whatsapp-templates_GET.schema";

/** Admin (autopilot module): Meta approval status of the autopilot's WhatsApp templates on Waplify. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const templates = await listAutopilotTemplateStatuses();
    return new Response(superjson.stringify({ templates } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load templates";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 502;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}