import { createMissingAutopilotTemplates, listAutopilotTemplateStatuses } from "../../helpers/autopilotWhatsAppTemplates";

/** Dev-only (never published): list, and with {"create": true} create, the autopilot WhatsApp templates. */
export async function handle(request: Request): Promise<Response> {
  try {
    const input = JSON.parse((await request.text()) || "{}") as { create?: boolean };
    const results = input.create ? await createMissingAutopilotTemplates() : undefined;
    const statuses = await listAutopilotTemplateStatuses();
    return new Response(JSON.stringify({ statuses, results }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
}