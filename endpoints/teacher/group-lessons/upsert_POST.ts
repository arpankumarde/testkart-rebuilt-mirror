import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { isTeacherSlotFree } from "../../../helpers/mentorshipSlots";
import { schema, OutputType } from "./upsert_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // The same teacher teaches both 1:1 sessions and group lessons, so a new
    // or rescheduled group lesson must not overlap anything already on their
    // calendar - checked against both mentorship bookings and other group
    // lessons (excluding this one, when editing).
    const timeFree = await isTeacherSlotFree(
      effectiveTeacherId,
      input.startTime,
      input.durationMinutes,
      undefined,
      input.id
    );
    if (!timeFree) {
      return new Response(
        superjson.stringify({ error: "You already have a 1:1 session or group lesson scheduled at this time." }),
        { status: 400 }
      );
    }

    if (input.id) {
      const existing = await db
        .selectFrom("groupLessons")
        .select(["id", "teacherId", "enrolledCount", "status"])
        .where("id", "=", input.id)
        .executeTakeFirst();
      if (!existing || (existing.teacherId !== effectiveTeacherId && user.role !== "admin")) {
        return new Response(superjson.stringify({ error: "Group lesson not found" }), { status: 404 });
      }
      if (existing.status !== "scheduled") {
        return new Response(superjson.stringify({ error: `A ${existing.status} lesson cannot be edited.` }), { status: 400 });
      }
      if (input.maxCapacity < existing.enrolledCount) {
        return new Response(
          superjson.stringify({ error: `Capacity cannot be lower than the ${existing.enrolledCount} learner(s) already enrolled.` }),
          { status: 400 }
        );
      }

      await db
        .updateTable("groupLessons")
        .set({
          title: input.title,
          description: input.description ?? null,
          subject: input.subject ?? null,
          level: input.level ?? null,
          language: input.language ?? null,
          startTime: input.startTime,
          durationMinutes: input.durationMinutes,
          pricePerLearner: input.pricePerLearner,
          maxCapacity: input.maxCapacity,
          minEnrollment: input.minEnrollment ?? null,
          minEnrollmentPolicy: input.minEnrollmentPolicy,
          coverImageUrl: input.coverImageUrl ?? null,
          coverImageFileId: input.coverImageFileId ?? null,
          updatedAt: new Date(),
        })
        .where("id", "=", input.id)
        .execute();

      const output: OutputType = { id: input.id };
      return new Response(superjson.stringify(output));
    }

    const inserted = await db
      .insertInto("groupLessons")
      .values({
        teacherId: effectiveTeacherId,
        title: input.title,
        description: input.description ?? null,
        subject: input.subject ?? null,
        level: input.level ?? null,
        language: input.language ?? null,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        pricePerLearner: input.pricePerLearner,
        maxCapacity: input.maxCapacity,
        minEnrollment: input.minEnrollment ?? null,
        minEnrollmentPolicy: input.minEnrollmentPolicy,
        coverImageUrl: input.coverImageUrl ?? null,
        coverImageFileId: input.coverImageFileId ?? null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const output: OutputType = { id: inserted.id };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving group lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
