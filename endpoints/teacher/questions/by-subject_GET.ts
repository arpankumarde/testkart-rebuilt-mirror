import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./by-subject_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";

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
    const subjectId = url.searchParams.get("subjectId");

    const input = schema.parse({
      subjectId: subjectId ? parseInt(subjectId, 10) : undefined,
    });

    // Ownership check: subject -> test item -> package -> teacher
    const ownershipCheck = await db
      .selectFrom("testItemSubjects")
      .innerJoin(
        "mockTestItems",
        "testItemSubjects.testItemId",
        "mockTestItems.id"
      )
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select("mockTests.teacherId")
      .where("testItemSubjects.id", "=", input.subjectId)
      .executeTakeFirst();

    if (!ownershipCheck) {
      return new Response(
        superjson.stringify({ error: "Subject not found" }),
        { status: 404 }
      );
    }

    if (ownershipCheck.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this subject's test" }),
        { status: 403 }
      );
    }

    const questions = await db
      .selectFrom("testQuestions")
      .selectAll()
      .where("subjectId", "=", input.subjectId)
            .orderBy("orderIndex", "asc")
      .orderBy("createdAt", "asc")
      .execute();

    return new Response(superjson.stringify(questions satisfies OutputType));
  } catch (error) {
    console.error("Error fetching questions by subject:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: "Invalid input", details: error.errors }),
        { status: 400 }
      );
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