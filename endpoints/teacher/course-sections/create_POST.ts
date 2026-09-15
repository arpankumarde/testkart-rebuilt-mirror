import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";

async function checkCourseOwnership(courseId: number, teacherId: number, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;
    const course = await db.selectFrom("courses").select("teacherId").where("id", "=", courseId).executeTakeFirst();
    return !!course && course.teacherId === teacherId;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const isOwner = await checkCourseOwnership(input.courseId, effectiveTeacherId, user.role);
    if (!isOwner) {
        return new Response(superjson.stringify({ error: "You do not own this course" }), { status: 403 });
    }

    // Get the next order index
    const lastSection = await db.selectFrom("courseSections")
        .select("orderIndex")
        .where("courseId", "=", input.courseId)
        .orderBy("orderIndex", "desc")
        .limit(1)
        .executeTakeFirst();
    
    const newOrderIndex = (lastSection?.orderIndex ?? 0) + 1;

    const newSection = await db.insertInto("courseSections")
        .values({
            courseId: input.courseId,
            title: input.title,
            description: input.description,
            orderIndex: newOrderIndex,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(newSection satisfies OutputType), { status: 201 });

  } catch (error) {
    console.error("Error creating course section:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to create section", details: errorMessage }), { status: 500 });
  }
}