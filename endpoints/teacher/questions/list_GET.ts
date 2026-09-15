import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
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

    const url = new URL(request.url);
    const testItemId = url.searchParams.get("testItemId");

    const input = schema.parse({
      testItemId: testItemId ? parseInt(testItemId, 10) : undefined,
    });

    const itemAndPackage = await db
      .selectFrom("mockTestItems")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select("mockTests.teacherId")
      .where("mockTestItems.id", "=", input.testItemId)
      .executeTakeFirst();

    if (!itemAndPackage) {
      return new Response(
        superjson.stringify({ error: "Test item not found" }),
        { status: 404 }
      );
    }

    if (itemAndPackage.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this test item" }),
        { status: 403 }
      );
    }

    const questions = await db
      .selectFrom("testQuestions")
      .selectAll()
      .where("testId", "=", input.testItemId)
      .orderBy("id", "asc")
      .execute();

    return new Response(superjson.stringify(questions satisfies OutputType));
  } catch (error) {
    console.error("Error listing questions:", error);
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