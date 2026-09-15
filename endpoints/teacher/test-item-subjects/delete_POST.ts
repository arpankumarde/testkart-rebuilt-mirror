import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";

async function verifyOwnership(subjectId: number, userId: number, userRole: string) {
  if (userRole === 'admin') return true;

  const subject = await db
    .selectFrom("testItemSubjects")
    .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
    .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
    .select("mockTests.teacherId")
    .where("testItemSubjects.id", "=", subjectId)
    .executeTakeFirst();

  if (!subject) {
    throw new Error("Subject not found");
  }

  if (subject.teacherId !== userId) {
    throw new Error("You do not have permission to delete this subject.");
  }
  
  return true;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized: Access denied" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { id } = schema.parse(json);

    await verifyOwnership(id, effectiveTeacherId, user.role);

    await db.transaction().execute(async (trx) => {
      // Cascade delete questions associated with this subject
      await trx
        .deleteFrom("testQuestions")
        .where("subjectId", "=", id)
        .execute();

      // Delete the subject itself
      const result = await trx
        .deleteFrom("testItemSubjects")
        .where("id", "=", id)
        .executeTakeFirst();

      if (result.numDeletedRows === 0n) {
        throw new Error("Subject not found or already deleted.");
      }
    });

    return new Response(superjson.stringify({ success: true, message: "Subject deleted successfully." } satisfies OutputType));
  } catch (error) {
    console.error("Error deleting test item subject:", error);
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
        status: 403,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}