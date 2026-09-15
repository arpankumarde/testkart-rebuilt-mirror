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
    const subjectId = url.searchParams.get("subjectId");

    const validatedInput = schema.parse({ subjectId });

    // Verify that the teacher owns the subject
    const subject = await db
      .selectFrom("testItemSubjects")
      .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select("mockTests.teacherId")
      .where("testItemSubjects.id", "=", validatedInput.subjectId)
      .executeTakeFirst();

    if (!subject) {
      return new Response(
        superjson.stringify({ error: "Subject not found" }),
        { status: 404 }
      );
    }

    if (user.role !== "admin" && subject.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({
          error: "You do not have permission to access sections for this subject.",
        }),
        { status: 403 }
      );
    }

    const sections = await db
      .selectFrom("subjectSections")
      .selectAll()
      .where("subjectId", "=", validatedInput.subjectId)
      .orderBy("orderIndex", "asc")
      .execute();

    return new Response(superjson.stringify(sections satisfies OutputType));
  } catch (error) {
    console.error("Error fetching subject sections:", error);
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