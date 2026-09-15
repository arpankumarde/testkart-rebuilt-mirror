import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./bulk-create_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";
import { splitNewSubjectNames } from "../../../helpers/testSeriesEditing";

async function verifyOwnership(testItemId: number, userId: number, userRole: string) {
  if (userRole === 'admin') return true;

  const testItem = await db
    .selectFrom("mockTestItems")
    .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
    .select("mockTests.teacherId")
    .where("mockTestItems.id", "=", testItemId)
    .executeTakeFirst();

  if (!testItem) {
    throw new Error("Test item not found");
  }

  if (testItem.teacherId !== userId) {
    throw new Error("You do not have permission to modify this test item.");
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
    const input = schema.parse(json);

    await verifyOwnership(input.testItemId, effectiveTeacherId, user.role);

    const result = await db.transaction().execute(async (trx): Promise<OutputType> => {
      const existingSubjects = await trx
        .selectFrom("testItemSubjects")
        .select("subjectName")
        .where("testItemId", "=", input.testItemId)
        .execute();

      // Names the item already has are reported back, not dropped silently.
      const { toCreate: uniqueNewSubjectNames, skipped } = splitNewSubjectNames(
        input.subjectNames,
        existingSubjects.map((s) => s.subjectName)
      );

      if (uniqueNewSubjectNames.length === 0) {
        return { created: [], skipped };
      }

      const maxOrder = await trx
        .selectFrom("testItemSubjects")
        .select((eb) => eb.fn.max("orderIndex").as("maxOrder"))
        .where("testItemId", "=", input.testItemId)
        .executeTakeFirst();

      let currentMaxOrder = maxOrder?.maxOrder ?? -1;

      const subjectsToInsert = uniqueNewSubjectNames.map((subjectName: string) => {
        currentMaxOrder++;
        return {
          testItemId: input.testItemId,
          subjectName,
          orderIndex: currentMaxOrder,
          // A starting duration so subject-wise timing totals mean something
          // before the teacher sets each subject's time.
          durationMinutes: 20,
        };
      });

      const created = await trx
        .insertInto("testItemSubjects")
        .values(subjectsToInsert)
        .returningAll()
        .execute();

      return { created, skipped };
    });

    return new Response(superjson.stringify(result));
  } catch (error) {
    console.error("Error bulk creating test item subjects:", error);
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
      // Use 404 for "not found" and 403 for permission errors
      const statusCode = error.message.includes("not found") ? 404 : 403;
      return new Response(superjson.stringify({ error: error.message }), {
        status: statusCode,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}