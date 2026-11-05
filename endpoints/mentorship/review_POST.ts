import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./review_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can leave a review." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    if (input.kind === "booking") {
      const booking = await db
        .selectFrom("mentorshipBookings")
        .select(["id", "studentId", "status"])
        .where("id", "=", input.id)
        .executeTakeFirst();
      if (!booking || booking.studentId !== user.id) {
        return new Response(superjson.stringify({ error: "Booking not found" }), { status: 404 });
      }
      if (booking.status !== "completed") {
        return new Response(superjson.stringify({ error: "You can review a session once it's completed." }), { status: 400 });
      }
    } else {
      const enrollment = await db
        .selectFrom("groupLessonEnrollments")
        .innerJoin("groupLessons", "groupLessons.id", "groupLessonEnrollments.groupLessonId")
        .select(["groupLessonEnrollments.id", "groupLessons.status"])
        .where("groupLessonEnrollments.groupLessonId", "=", input.id)
        .where("groupLessonEnrollments.studentId", "=", user.id)
        .executeTakeFirst();
      if (!enrollment) {
        return new Response(superjson.stringify({ error: "You were not enrolled in this group lesson." }), { status: 404 });
      }
      if (enrollment.status !== "completed") {
        return new Response(superjson.stringify({ error: "You can review a lesson once it's completed." }), { status: 400 });
      }
    }

    const existing = await db
      .selectFrom("reviews")
      .select("id")
      .where("userId", "=", user.id)
      .where(input.kind === "booking" ? "mentorshipBookingId" : "groupLessonId", "=", input.id)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable("reviews")
        .set({ rating: input.rating, reviewText: input.reviewText ?? null, updatedAt: new Date() })
        .where("id", "=", existing.id)
        .execute();
    } else {
      await db
        .insertInto("reviews")
        .values({
          userId: user.id,
          reviewerName: user.displayName,
          rating: input.rating,
          reviewText: input.reviewText ?? null,
          mentorshipBookingId: input.kind === "booking" ? input.id : null,
          groupLessonId: input.kind === "group" ? input.id : null,
        })
        .execute();
    }

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error submitting mentorship review:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
