import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { AutopilotAiError, autopilotAiText } from "../../../helpers/autopilotAi";
import { schema, OutputType } from "./ai-test_POST.schema";

const INSTRUCTIONS =
  "You write short, warm WhatsApp reminders for Testkart, an Indian exam-prep marketplace. Plain English an " +
  "aspirant in a small town reads easily. At most 300 characters, one emoji at most, no fake urgency, no " +
  "discount unless one is given. End with the link placeholder {link}.";

const SAMPLE =
  "Student first name: Priya. She tried to pay Rs 99 for 'SSC CGL 2026 Full Mock Test Series (20 tests)' and " +
  "left the payment page 15 minutes ago. Her exam is in 42 days. Write the reminder.";

/** Admin (autopilot module): one sample draft with the provider chosen on the Autopilot page. Nothing is sent or stored. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    schema.parse(superjson.parse(await request.text()));
    const result = await autopilotAiText({ instructions: INSTRUCTIONS, input: SAMPLE, maxOutputTokens: 300 });
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    if (error instanceof AutopilotAiError) {
      const status = error.code === "OUT_OF_CREDITS" ? 503 : error.code === "UPSTREAM" ? 502 : 400;
      return new Response(superjson.stringify({ error: error.message, code: error.code }), { status });
    }
    const message = error instanceof Error ? error.message : "The sample draft failed";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 500;
    if (status === 500) console.error("Autopilot AI test failed:", error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}