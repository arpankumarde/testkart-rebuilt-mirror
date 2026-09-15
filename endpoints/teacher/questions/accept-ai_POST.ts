import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncToQuestionBank } from "../../../helpers/syncToQuestionBank";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./accept-ai_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only teachers can add AI questions." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const input = schema.parse(body);
    const { subjectId, sectionId, questions } = input;

    // Verify ownership through testItemSubjects -> mockTestItems -> mockTests
    const subjectAndOwner = await db
      .selectFrom("testItemSubjects")
      .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select([
        "mockTests.teacherId",
        "mockTests.id as mockTestId",
        "mockTestItems.id as testItemId",
        "testItemSubjects.subjectName",
      ])
      .where("testItemSubjects.id", "=", subjectId)
      .executeTakeFirst();

    if (!subjectAndOwner) {
      return new Response(
        JSON.stringify({ error: "Subject not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (subjectAndOwner.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "You do not own this subject" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // A section, when given, must belong to the subject being added to.
    if (sectionId != null) {
      const section = await db
        .selectFrom("subjectSections")
        .select("id")
        .where("id", "=", sectionId)
        .where("subjectId", "=", subjectId)
        .executeTakeFirst();

      if (!section) {
        return new Response(
          JSON.stringify({ error: "Section not found for this subject" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Append after whatever is already in the subject instead of piling every
    // AI question at order_index 0, which is what made them land above the
    // teacher's own questions in the list.
    const maxOrder = await db
      .selectFrom("testQuestions")
      .select((eb) => eb.fn.max("orderIndex").as("maxOrderIndex"))
      .where("subjectId", "=", subjectId)
      .executeTakeFirst();

    const startOrderIndex = Number(maxOrder?.maxOrderIndex ?? -1) + 1;

    const rows = questions.map((q, index) => ({
      subjectId,
      sectionId: sectionId ?? null,
      testId: subjectAndOwner.testItemId,
      orderIndex: startOrderIndex + index,
      questionText: q.questionText,
      questionType: q.questionType,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      optionE: null,
      correctOption: q.correctOption,
      correctOptions: q.correctOptions,
      numericalAnswer: q.numericalAnswer,
      numericalTolerance: q.numericalTolerance,
      matchData: null,
      paragraphText: null,
      explanation: q.explanation,
      isAiGenerated: true,
      markedForReview: false,
      ...(q.positiveMarks != null ? { positiveMarks: q.positiveMarks } : {}),
      ...(q.negativeMarks != null ? { negativeMarks: q.negativeMarks } : {}),
    }));

    const questionIds = await db.transaction().execute(async (trx) => {
      const result = await trx
        .insertInto("testQuestions")
        .values(rows as any)
        .returning("id")
        .execute();
      return result.map((row) => row.id);
    });

    await syncToQuestionBank(
      effectiveTeacherId,
      rows.map((q) => ({ ...q, subjectName: subjectAndOwner.subjectName })) as any,
      {
        sourceMockTestId: subjectAndOwner.mockTestId,
        sourceTestItemId: subjectAndOwner.testItemId,
        sourceTestQuestionIds: questionIds,
      }
    );

    // Keeps mock_tests.total_questions in step, the way the manual create path
    // already does — without it the package still reads as having 0 questions.
    await syncMockTestAggregates(subjectAndOwner.mockTestId).catch((err) =>
      console.error("Failed to sync aggregates:", err)
    );

    console.log(
      `[accept-ai] Saved ${questionIds.length} accepted AI question(s) to subject ${subjectId} for teacher ${user.id}`
    );

    const output: OutputType = {
      success: true,
      questionsAdded: questionIds.length,
      questionIds,
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error accepting AI questions:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
