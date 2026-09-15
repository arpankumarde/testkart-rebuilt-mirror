import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./reorder_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";

async function checkCourseOwnership(courseId: number, teacherId: number, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;
    const course = await db.selectFrom("courses").select("teacherId").where("id", "=", courseId).executeTakeFirst();
    return !!course && course.teacherId === teacherId;
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
    const { courseId, orderedSectionIds } = schema.parse(json);

    const isOwner = await checkCourseOwnership(courseId, effectiveTeacherId, user.role);
    if (!isOwner) {
        return new Response(superjson.stringify({ error: "You do not own this course" }), { status: 403 });
    }

    const applied = await db.transaction().execute(async (trx) => {
        const existing = await trx.selectFrom("courseSections")
            .select("id")
            .where("courseId", "=", courseId)
            .forUpdate()
            .execute();

        if (!isSameIdSet(existing.map((s) => s.id), orderedSectionIds)) {
            return false;
        }

        // (course_id, order_index) is UNIQUE and not deferrable, so writing the final
        // indexes directly collides mid-swap. Park every row on a distinct negative
        // index first, then write the real positions.
        for (let index = 0; index < orderedSectionIds.length; index++) {
            await trx.updateTable("courseSections")
                .set({ orderIndex: -(index + 1) })
                .where("id", "=", orderedSectionIds[index])
                .where("courseId", "=", courseId)
                .execute();
        }
        for (let index = 0; index < orderedSectionIds.length; index++) {
            await trx.updateTable("courseSections")
                .set({ orderIndex: index + 1 })
                .where("id", "=", orderedSectionIds[index])
                .where("courseId", "=", courseId)
                .execute();
        }
        return true;
    });

    if (!applied) {
        return new Response(
            superjson.stringify({ error: "The section list changed since this page loaded. Reload and try again." }),
            { status: 409 }
        );
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));

  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid reorder request" }), { status: 400 });
    }
    console.error("Error reordering course sections:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to reorder sections", details: errorMessage }), { status: 500 });
  }
}