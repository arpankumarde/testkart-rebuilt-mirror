import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./by-exam_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // The request specifies to only allow teachers, not even admins.
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Unauthorized: Only teachers can access this resource." }),
        { status: 403 } // 403 Forbidden is more appropriate than 401 Unauthorized for role issues.
      );
    }

    const url = new URL(request.url);
    const examId = url.searchParams.get("examId");

    const input = schema.parse({
      examId: examId ? parseInt(examId, 10) : undefined,
    });

    const subjects = await db
      .selectFrom("examSubjects")
      .select(["id", "subjectName", "examId"])
      .where("examId", "=", input.examId)
      .orderBy("subjectName", "asc")
      .execute();

    return new Response(superjson.stringify(subjects satisfies OutputType));
  } catch (error) {
    console.error("Error fetching exam subjects:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: "Invalid input: " + error.message }),
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