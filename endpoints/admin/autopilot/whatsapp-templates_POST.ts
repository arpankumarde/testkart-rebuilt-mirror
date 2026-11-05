import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { createMissingAutopilotTemplates } from "../../../helpers/autopilotWhatsAppTemplates";
import { OutputType } from "./whatsapp-templates_POST.schema";

/** Admin (autopilot module): submits any missing autopilot WhatsApp templates to Meta through Waplify. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const results = await createMissingAutopilotTemplates();
    console.log(`Autopilot WhatsApp templates requested by admin ${admin.id}: ${JSON.stringify(results)}`);
    return new Response(superjson.stringify({ results } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create templates";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 502;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}