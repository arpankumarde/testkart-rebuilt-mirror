import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncToQuestionBank } from "../../../helpers/syncToQuestionBank";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./bulk-upload_POST.schema";
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

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Verify ownership through testItemSubjects -> mockTestItems -> mockTests
    const subjectAndOwner = await db
      .selectFrom("testItemSubjects")
      .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select(["mockTests.teacherId", "mockTests.id as mockTestId", "mockTestItems.id as testItemId", "testItemSubjects.subjectName"])
      .where("testItemSubjects.id", "=", input.subjectId)
      .executeTakeFirst();

    if (!subjectAndOwner) {
      return new Response(
        superjson.stringify({ error: "Subject not found" }),
        { status: 404 }
      );
    }

    if (subjectAndOwner.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this subject" }),
        { status: 403 }
      );
    }

    if (input.sectionId != null) {
      const section = await db
        .selectFrom("subjectSections")
        .select("id")
        .where("id", "=", input.sectionId)
        .where("subjectId", "=", input.subjectId)
        .executeTakeFirst();

      if (!section) {
        return new Response(
          superjson.stringify({ error: "Section not found for this subject" }),
          { status: 404 }
        );
      }
    }

    const maxOrder = await db
      .selectFrom("testQuestions")
      .select((eb) => eb.fn.max("orderIndex").as("maxOrderIndex"))
      .where("subjectId", "=", input.subjectId)
      .executeTakeFirst();
    const startOrderIndex = Number(maxOrder?.maxOrderIndex ?? -1) + 1;

    const questionsToInsert = input.questions.map((q, index) => {
            let questionData: any = {
        subjectId: input.subjectId,
        sectionId: input.sectionId ?? null,
        testId: subjectAndOwner.testItemId,
        orderIndex: startOrderIndex + index,
        questionText: q.questionText,
        questionType: q.questionType,
        positiveMarks: q.positiveMarks,
        negativeMarks: q.negativeMarks,
        explanation: q.explanation,
      };

      if (q.questionType === "single_correct_mcq") {
        questionData = {
          ...questionData,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
        optionD: q.optionD,
        optionE: q.optionE ?? null,
        correctOption: q.correctOption,
        correctOptions: null,
          numericalAnswer: null,
          numericalTolerance: null,
          matchData: null,
          paragraphText: null,
        };
      } else if (q.questionType === "multiple_correct_mcq") {
        questionData = {
          ...questionData,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
        optionD: q.optionD,
        optionE: q.optionE ?? null,
        correctOptions: q.correctOptions,
        partialMarking: q.partialMarking,
          correctOption: null,
          numericalAnswer: null,
          numericalTolerance: null,
          matchData: null,
          paragraphText: null,
        };
      } else if (q.questionType === "numerical") {
        questionData = {
          ...questionData,
          numericalAnswer: q.numericalAnswer,
          numericalTolerance: q.numericalTolerance,
          optionA: null,
          optionB: null,
          optionC: null,
        optionD: null,
        optionE: null,
        correctOption: null,
        correctOptions: null,
        matchData: null,
        paragraphText: null,
      };
      } else if (q.questionType === "comprehension") {
        questionData = {
          ...questionData,
          paragraphText: q.paragraphText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
        optionD: q.optionD,
        optionE: q.optionE ?? null,
        correctOption: q.correctOption,
        correctOptions: null,
          numericalAnswer: null,
          numericalTolerance: null,
          matchData: null,
        };
      } else if (q.questionType === "assertion_reason") {
        questionData = {
          ...questionData,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
        optionD: q.optionD,
        optionE: q.optionE ?? null,
        correctOption: q.correctOption,
        correctOptions: null,
          numericalAnswer: null,
          numericalTolerance: null,
          matchData: null,
          paragraphText: null,
        };
      }

      return questionData;
    });

    if (questionsToInsert.length === 0) {
        return new Response(
            superjson.stringify({ error: "No questions provided for upload." }),
            { status: 400 }
        );
    }

    const createdQuestions = await db.transaction().execute(async (trx) => {
        return await trx
            .insertInto("testQuestions")
            .values(questionsToInsert)
            .returning(['id'])
            .execute();
    });

    const questionIds = createdQuestions.map(q => q.id);

            await syncToQuestionBank(effectiveTeacherId, questionsToInsert.map(q => ({ ...q, subjectName: subjectAndOwner.subjectName })), {
      sourceMockTestId: subjectAndOwner.mockTestId,
      sourceTestItemId: subjectAndOwner.testItemId,
      sourceTestQuestionIds: questionIds,
    });

        await syncMockTestAggregates(subjectAndOwner.mockTestId).catch(err => console.error("Failed to sync aggregates:", err));

    return new Response(superjson.stringify({
      count: questionIds.length,
      questionIds,
      message: `${questionIds.length} questions created successfully.`
    } satisfies OutputType));

  } catch (error) {
    console.error("Error bulk uploading questions:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Validation failed", details: error.errors }), {
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