import superjson from "superjson";
import { ZodError } from "zod";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { setLiveAttendance } from "../../../helpers/liveSessionLifecycle";
import { schema, OutputType } from "./attendance_POST.schema";

/* An admin records whether one learner attended. Session status and payments are not changed. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const output: OutputType = await setLiveAttendance({
      type: input.type,
      id: input.id,
      attendance: input.attendance,
      reason: input.reason,
      actor: { type: "admin", id: admin.id, label: admin.fullName ?? admin.email ?? String(admin.id) },
    });
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live attendance failed:", error);
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message ?? "Check the details and try again."
        : error instanceof Error
          ? error.message
          : "Could not update attendance.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}