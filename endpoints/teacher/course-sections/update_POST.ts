import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";

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
    const { sectionId, ...updateData } = input;

    const isOwner = await checkSectionOwnership(sectionId, effectiveTeacherId, user.role);
    if (!isOwner) {
        return new Response(superjson.stringify({ error: "You do not own this course section" }), { status: 403 });
    }

    const updatedSection = await db.updateTable("courseSections")
        .set({
            ...updateData,
            updatedAt: new Date(),
        })
        .where("id", "=", sectionId)
        .returningAll()
        .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(updatedSection satisfies OutputType));

  } catch (error) {
    console.error("Error updating course section:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to update section", details: errorMessage }), { status: 500 });
  }
}