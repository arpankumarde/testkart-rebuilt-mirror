import { schema, OutputType } from "./bulk-update-marks_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { db } from '../../../helpers/db';

export async function handle(request: Request) {
  try {
    const session = await getServerUserSession(request);

    if (session.user.role !== "teacher" && session.user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized access" }),
        { status: 403 }
      );
    }

    const text = await request.text();
    const json = superjson.parse(text);
    const input = schema.parse(json);

    // Verify ownership of the subject
    const subjectInfo = await db.
    selectFrom("testItemSubjects").
    innerJoin("mockTestItems", "mockTestItems.id", "testItemSubjects.testItemId").
    innerJoin("mockTests", "mockTests.id", "mockTestItems.packageId").
    select(["mockTests.teacherId"]).
    where("testItemSubjects.id", "=", input.subjectId).
    executeTakeFirst();

    if (!subjectInfo) {
      return new Response(
        superjson.stringify({ error: "Subject not found" }),
        { status: 404 }
      );
    }

    if (
    session.user.role !== "admin" &&
    subjectInfo.teacherId !== session.effectiveTeacherId)
    {
      return new Response(
        superjson.stringify({ error: "You do not have permission to update this subject's questions" }),
        { status: 403 }
      );
    }

    // Perform bulk update
    const updateResult = await db.
    updateTable("testQuestions").
    set({
      positiveMarks: input.positiveMarks,
      negativeMarks: input.negativeMarks
    }).
    where("subjectId", "=", input.subjectId).
    executeTakeFirst();

    return new Response(
      superjson.stringify({
        updatedCount: Number(updateResult.numUpdatedRows || 0)
      } satisfies OutputType)
    );
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error"
      }),
      { status: 400 }
    );
  }
}