import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { getAutopilotDashboard } from "../../../helpers/autopilotDashboardData";
import { schema, OutputType } from "./overview_GET.schema";

/** Admin (autopilot module): the Autopilot page's figures for the last 7, 30 or 90 days. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const { days } = schema.parse({ days: url.searchParams.get("days") ?? undefined });
    const data = await getAutopilotDashboard(days);
    return new Response(superjson.stringify(data satisfies OutputType), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the autopilot figures";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 500;
    if (status === 500) console.error("Autopilot overview failed:", error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}