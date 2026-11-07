import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { getAutopilotOperations } from "../../../helpers/autopilotOperationsData";
import { OutputType } from "./operations_GET.schema";

/** Admin (autopilot module): the Operations tab - engine runs, hourly sends and queue, step funnels, failure reasons. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const data = await getAutopilotOperations();
    return new Response(superjson.stringify(data satisfies OutputType), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the autopilot operations";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 500;
    if (status === 500) console.error("Autopilot operations failed:", error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}