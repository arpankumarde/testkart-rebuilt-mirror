import { sql } from "kysely";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./reply_POST.schema";

/**
 * Saves, edits or removes the teacher's public reply to one review on their
 * own test series, course or notes. Students see it under the review.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const reply = input.reply?.trim() || null;

    const owned = await sql<{ id: number }>`
      SELECT r.id
      FROM reviews r
      LEFT JOIN mock_tests mt ON mt.id = r.mock_test_id
      LEFT JOIN courses c ON c.id = r.course_id
      LEFT JOIN digital_products dp ON dp.id = r.digital_product_id
      WHERE r.id = ${input.reviewId}
        AND coalesce(mt.teacher_id, c.teacher_id, dp.teacher_id) = ${effectiveTeacherId}
    `.execute(db);
    if (owned.rows.length === 0) {
      return new Response(superjson.stringify({ error: "This review is not on one of your listings." }), { status: 404 });
    }

    const updated = await db
      .updateTable("reviews")
      .set({ teacherReply: reply, teacherRepliedAt: reply ? new Date() : null })
      .where("id", "=", input.reviewId)
      .returning(["id", "teacherReply", "teacherRepliedAt"])
      .executeTakeFirstOrThrow();

    const output: OutputType = {
      reviewId: updated.id,
      teacherReply: updated.teacherReply,
      teacherRepliedAt: updated.teacherRepliedAt,
    };
    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: error.issues[0]?.message ?? "Check the reply and try again." }), { status: 400 });
    }
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error saving review reply:", error);
    return new Response(superjson.stringify({ error: "Your reply was not saved. Try again." }), { status: 500 });
  }
}