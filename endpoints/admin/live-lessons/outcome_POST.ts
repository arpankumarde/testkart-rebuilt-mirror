import superjson from "superjson";
import { ZodError } from "zod";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { completeLiveSession, markLiveSessionNoShow, type LiveActor } from "../../../helpers/liveSessionLifecycle";
import { schema, OutputType } from "./outcome_POST.schema";

/* An admin sets the teacher's session status: completed or missed. Settles a credit-paid class at once. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const actor: LiveActor = { type: "admin", id: admin.id, label: admin.fullName ?? admin.email ?? String(admin.id) };

    let output: OutputType;
    if (input.action === "complete") {
      const r = await completeLiveSession({ kind: "booking", id: input.id, actor, settleNow: true, reason: input.reason });
      output = { status: "completed", changed: r.changed, creditReturned: null };
    } else {
      const r = await markLiveSessionNoShow({ id: input.id, party: "teacher", actor, settleNow: true, reason: input.reason });
      output = { status: "missed", changed: r.changed, creditReturned: r.creditReturned };
    }
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live outcome failed:", error);
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message ?? "Check the details and try again."
        : error instanceof Error
          ? error.message
          : "Could not update this session.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}