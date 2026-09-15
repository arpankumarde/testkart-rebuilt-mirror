import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./unpublish_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    const course = await db
      .selectFrom("courses")
      .select(["teacherId", "status"])
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!course) {
      return new Response(
        superjson.stringify({ error: "Course not found" }),
        { status: 404 }
      );
    }

    if (course.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this course" }),
        { status: 403 }
      );
    }

    if (course.status !== "published") {
      return new Response(
        superjson.stringify({ error: "Course is not published" }),
        { status: 400 }
      );
    }

    const updatedCourse = await db
      .updateTable("courses")
      .set({ status: "draft", updatedAt: new Date() })
      .where("id", "=", courseId)
      .returningAll()
      .executeTakeFirstOrThrow();

    const deletedCartItems = await db
      .deleteFrom("cartItems")
      .where("courseId", "=", courseId)
      .executeTakeFirst();
    console.log(`Deleted ${deletedCartItems.numDeletedRows} cart item(s) for unpublished course ${courseId}`);

    const output: OutputType = {
      ...updatedCourse,
      price: Number(updatedCourse.price),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error unpublishing course:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to unpublish course", details: errorMessage }),
      { status: 500 }
    );
  }
}