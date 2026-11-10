import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./update_POST.schema";

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const { id, status, adminNotes } = schema.parse(superjson.parse(await request.text()));

    const current = await db.selectFrom("contentReports").select(["status"]).where("id", "=", id).executeTakeFirst();
    if (!current) return json({ error: "Report not found" }, 404);

    const now = new Date();
    const statusChanged = status !== undefined && status !== current.status;
    const notes = adminNotes === undefined ? undefined : adminNotes.trim() || null;

    const updated = await db
      .updateTable("contentReports")
      .set({
        updatedAt: now,
        reviewedByAdminId: admin.id,
        ...(statusChanged ? { status, statusChangedAt: now } : {}),
        ...(notes !== undefined ? { adminNotes: notes } : {}),
      })
      .where("id", "=", id)
      .returning(["status", "adminNotes"])
      .executeTakeFirstOrThrow();

    return json({ success: true, status: updated.status, adminNotes: updated.adminNotes } satisfies OutputType);
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: error.errors[0]?.message ?? "Invalid input" }, 400);
    }
    if (error instanceof Error && (error.name === "NotAuthenticatedError" || error.name === "ForbiddenError")) {
      return json({ error: error.message }, error.name === "NotAuthenticatedError" ? 401 : 403);
    }
    console.error("Failed to update content report:", error);
    return json({ error: error instanceof Error ? error.message : "An unknown error occurred" }, 500);
  }
}