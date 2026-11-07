import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { getAutopilotJourney } from "../../../helpers/autopilotJourneyData";
import { schema, OutputType } from "./journey_GET.schema";

/** Admin (autopilot module): one student's autopilot journey - reachability, playbooks and a timeline. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const { userId } = schema.parse({ userId: url.searchParams.get("userId") ?? undefined });
    const data = await getAutopilotJourney(userId);
    if (!data) return new Response(superjson.stringify({ error: "Student not found" }), { status: 404 });
    return new Response(superjson.stringify(data satisfies OutputType), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the journey";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : /invalid|expected/i.test(message) ? 400 : 500;
    if (status === 500) console.error("Autopilot journey failed:", error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}