import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./reorder_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";

async function checkSectionOwnership(sectionId: number, teacherId: number, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;
    const section = await db.selectFrom("courseSections")
        .innerJoin("courses", "courses.id", "courseSections.courseId")
        .select("courses.teacherId")
        .where("courseSections.id", "=", sectionId)
        .executeTakeFirst();
    return !!section && section.teacherId === teacherId;
}

function isSameIdSet(existingIds: number[], submittedIds: number[]): boolean {
    const existing = new Set(existingIds);
    return (
        submittedIds.length === existing.size &&
        new Set(submittedIds).size === submittedIds.length &&
        submittedIds.every((id) => existing.has(id))
    );
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { sectionId, orderedLessonIds } = schema.parse(json);

    const isOwner = await checkSectionOwnership(sectionId, effectiveTeacherId, user.role);
    if (!isOwner) {
        return new Response(superjson.stringify({ error: "You do not own this course section" }), { status: 403 });
    }

    const applied = await db.transaction().execute(async (trx) => {
        const existing = await trx.selectFrom("courseLessons")
            .select("id")
            .where("sectionId", "=", sectionId)
            .forUpdate()
            .execute();

        if (!isSameIdSet(existing.map((l) => l.id), orderedLessonIds)) {
            return false;
        }

        // (section_id, order_index) is UNIQUE and not deferrable, so writing the final
        // indexes directly collides mid-swap. Park every row on a distinct negative
        // index first, then write the real positions.
        for (let index = 0; index < orderedLessonIds.length; index++) {
            await trx.updateTable("courseLessons")
                .set({ orderIndex: -(index + 1) })
                .where("id", "=", orderedLessonIds[index])
                .where("sectionId", "=", sectionId)
                .execute();
        }
        for (let index = 0; index < orderedLessonIds.length; index++) {
            await trx.updateTable("courseLessons")
                .set({ orderIndex: index + 1 })
                .where("id", "=", orderedLessonIds[index])
                .where("sectionId", "=", sectionId)
                .execute();
        }
        return true;
    });

    if (!applied) {
        return new Response(
            superjson.stringify({ error: "The lesson list changed since this page loaded. Reload and try again." }),
            { status: 409 }
        );
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));

  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid reorder request" }), { status: 400 });
    }
    console.error("Error reordering course lessons:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to reorder lessons", details: errorMessage }), { status: 500 });
  }
}