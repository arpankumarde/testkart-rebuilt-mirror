import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./complete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    if (input.kind === "booking") {
      const booking = await db
        .selectFrom("mentorshipBookings")
        .select(["id", "teacherId", "status", "scheduledAt"])
        .where("id", "=", input.id)
        .executeTakeFirst();
      if (!booking) return new Response(superjson.stringify({ error: "Booking not found" }), { status: 404 });
      if (booking.teacherId !== effectiveTeacherId && user.role !== "admin") {
        return new Response(superjson.stringify({ error: "Only the teacher can mark this session's outcome." }), { status: 403 });
      }
      if (booking.status === "completed" || booking.status === "no_show") {
        const output: OutputType = { success: true, status: booking.status };
        return new Response(superjson.stringify(output));
      }
      if (booking.status === "cancelled") {
        return new Response(superjson.stringify({ error: "This booking was cancelled." }), { status: 400 });
      }
      if (booking.scheduledAt > new Date()) {
        return new Response(superjson.stringify({ error: "This session hasn't started yet." }), { status: 400 });
      }

      const outcome = input.outcome ?? "completed";
      await db.updateTable("mentorshipBookings").set({ status: outcome, updatedAt: new Date() }).where("id", "=", input.id).execute();

      const output: OutputType = { success: true, status: outcome };
      return new Response(superjson.stringify(output));
    }

    const lesson = await db
      .selectFrom("groupLessons")
      .select(["id", "teacherId", "status", "startTime"])
      .where("id", "=", input.id)
      .executeTakeFirst();
    if (!lesson) return new Response(superjson.stringify({ error: "Group lesson not found" }), { status: 404 });
    if (lesson.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Only the teacher can mark this lesson complete." }), { status: 403 });
    }
    if (lesson.status === "completed") {
      const output: OutputType = { success: true, status: "completed" };
      return new Response(superjson.stringify(output));
    }
    if (lesson.status === "cancelled") {
      return new Response(superjson.stringify({ error: "This group lesson was cancelled." }), { status: 400 });
    }
    if (lesson.startTime > new Date()) {
      return new Response(superjson.stringify({ error: "This lesson hasn't started yet." }), { status: 400 });
    }

    await db.updateTable("groupLessons").set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where("id", "=", input.id).execute();

    const output: OutputType = { success: true, status: "completed" };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error completing lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
