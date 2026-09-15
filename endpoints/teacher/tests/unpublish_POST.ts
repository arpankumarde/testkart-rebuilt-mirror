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
    const input = schema.parse(json);
    const { testId } = input;

    const test = await db
      .selectFrom("mockTests")
      .select(["teacherId", "isPublished"])
      .where("id", "=", testId)
      .executeTakeFirst();

    if (!test) {
      return new Response(
        superjson.stringify({ error: "Test not found" }),
        { status: 404 }
      );
    }

    // Admins can unpublish any test, teachers can only unpublish their own
    if (user.role === "teacher" && test.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this test" }),
        { status: 403 }
      );
    }

    if (!test.isPublished) {
      return new Response(
        superjson.stringify({ error: "Test is already unpublished" }),
        { status: 400 }
      );
    }

    await db
      .updateTable("mockTests")
      .set({ isPublished: false, updatedAt: new Date() })
      .where("id", "=", testId)
      .execute();

    await db
      .deleteFrom("cartItems")
      .where("mockTestId", "=", testId)
      .execute();

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error unpublishing test:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}