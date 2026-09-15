import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncToQuestionBank } from "../../../helpers/syncToQuestionBank";
import { schema, OutputType } from "./import-to-test_POST.schema";
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

    // Verify ownership of the target test
    const subjectOwner = await db
      .selectFrom("testItemSubjects")
      .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select(["mockTests.teacherId", "mockTests.id as mockTestId", "mockTestItems.id as testItemId", "testItemSubjects.subjectName"])
      .where("testItemSubjects.id", "=", input.subjectId)
      .executeTakeFirst();

    if (!subjectOwner || subjectOwner.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "Access denied to test subject" }),
        { status: 403 }
      );
    }

    // Fetch the specific questions from the bank safely
    const bankQs = await db
      .selectFrom("questionBank")
      .selectAll()
      .where("id", "in", input.questionBankIds)
      .where("teacherId", "=", effectiveTeacherId)
      .execute();

    if (bankQs.length === 0) {
      return new Response(superjson.stringify({ success: true, importedCount: 0 }));
    }

    const subjectName = subjectOwner.subjectName;

    const newTestQs = bankQs.map((bq) => ({
      subjectId: input.subjectId,
      testId: subjectOwner.testItemId,
      questionText: bq.questionText,
      questionType: bq.questionType,
      positiveMarks: bq.positiveMarks,
      negativeMarks: bq.negativeMarks,
      explanation: bq.explanation,
      durationSeconds: bq.durationSeconds,
      correctOption: bq.correctOption,
      correctOptions: bq.correctOptions,
      numericalAnswer: bq.numericalAnswer,
      numericalTolerance: bq.numericalTolerance,
      matchData: bq.matchData,
      paragraphText: bq.paragraphText,
      partialMarking: bq.partialMarking,
      optionA: bq.optionA,
      optionB: bq.optionB,
      optionC: bq.optionC,
            optionD: bq.optionD,
      optionE: bq.optionE,
      sourceBankQuestionId: bq.id,
    }));

    const insertedTestQs = await db.insertInto("testQuestions").values(newTestQs).returning(["id"]).execute();

    // Sync imported questions back to question bank as independent entries
    await syncToQuestionBank(
      effectiveTeacherId,
      newTestQs.map((q) => ({
...q,
questionType: (q.questionType ?? "single_correct_mcq") as string,
subjectName,
})),
      {
        sourceMockTestId: subjectOwner.mockTestId,
        sourceTestItemId: subjectOwner.testItemId,
        sourceTestQuestionIds: insertedTestQs.map((tq) => tq.id),
      }
    );

    return new Response(
      superjson.stringify({ 
        success: true, 
        importedCount: newTestQs.length 
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred" }), { status: 500 });
  }
}