import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { sanitizeOptionalHtml } from "../../../helpers/sanitizeHtml";

async function checkSectionOwnership(sectionId: number, teacherId: number, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;
    const section = await db.selectFrom("courseSections")
        .innerJoin("courses", "courses.id", "courseSections.courseId")
        .select("courses.teacherId")
        .where("courseSections.id", "=", sectionId)
        .executeTakeFirst();
    return !!section && section.teacherId === teacherId;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const isOwner = await checkSectionOwnership(input.sectionId, effectiveTeacherId, user.role);
    if (!isOwner) {
        return new Response(superjson.stringify({ error: "You do not own this course section" }), { status: 403 });
    }

    const lastLesson = await db.selectFrom("courseLessons")
        .select("orderIndex")
        .where("sectionId", "=", input.sectionId)
        .orderBy("orderIndex", "desc")
        .limit(1)
        .executeTakeFirst();
    
    const newOrderIndex = (lastLesson?.orderIndex ?? 0) + 1;

    const newLesson = await db.insertInto("courseLessons")
        .values({
            ...input,
            textContent: sanitizeOptionalHtml(input.textContent),
            orderIndex: newOrderIndex,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(newLesson satisfies OutputType), { status: 201 });

  } catch (error) {
    console.error("Error creating course lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to create lesson", details: errorMessage }), { status: 500 });
  }
}