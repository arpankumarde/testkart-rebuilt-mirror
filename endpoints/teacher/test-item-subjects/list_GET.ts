import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized: Access denied" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const testItemId = url.searchParams.get("testItemId");

    const validatedInput = schema.parse({ testItemId });

    // Verify that the teacher owns the test item
    const testItem = await db
      .selectFrom("mockTestItems")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select("mockTests.teacherId")
      .where("mockTestItems.id", "=", validatedInput.testItemId)
      .executeTakeFirst();

    if (!testItem) {
      return new Response(
        superjson.stringify({ error: "Test item not found" }),
        { status: 404 }
      );
    }

    if (user.role !== "admin" && testItem.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({
          error: "You do not have permission to access subjects for this test item.",
        }),
        { status: 403 }
      );
    }

    const subjects = await db
      .selectFrom("testItemSubjects")
      .leftJoin("testQuestions", "testQuestions.subjectId", "testItemSubjects.id")
      .select([
        "testItemSubjects.id",
        "testItemSubjects.testItemId",
        "testItemSubjects.subjectName",
        "testItemSubjects.orderIndex",
        "testItemSubjects.durationMinutes",
        "testItemSubjects.maxAttemptsAllowed",
        "testItemSubjects.createdAt",
        (eb) => eb.fn.count<number>("testQuestions.id").as("actualQuestionCount")
      ])
      .where("testItemSubjects.testItemId", "=", validatedInput.testItemId)
      .groupBy("testItemSubjects.id")
      .orderBy("testItemSubjects.orderIndex", "asc")
      .execute();

    // Convert actualQuestionCount from string to number
    const subjectsWithNumericCount = subjects.map(subject => ({
      ...subject,
      actualQuestionCount: Number(subject.actualQuestionCount)
    }));

    return new Response(superjson.stringify(subjectsWithNumericCount satisfies OutputType));
  } catch (error) {
    console.error("Error fetching test item subjects:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Authentication required" }), {
        status: 401,
      });
    }
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input", details: error.errors }), {
        status: 400,
      });
    }
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