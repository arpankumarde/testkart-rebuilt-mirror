import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncToQuestionBank } from "../../../helpers/syncToQuestionBank";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./create_POST.schema";
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

    // Append after the subject's existing questions. Order 0 put every new
    // question above any the teacher had already reordered.
    const maxOrder = await db
      .selectFrom("testQuestions")
      .select((eb) => eb.fn.max("orderIndex").as("maxOrderIndex"))
      .where("subjectId", "=", input.subjectId)
      .executeTakeFirst();

    // Build the question data based on question type
    let questionData: any = {
      subjectId: input.subjectId,
      sectionId: input.sectionId ?? null,
      testId: subjectAndOwner.testItemId,
      orderIndex: Number(maxOrder?.maxOrderIndex ?? -1) + 1,
      questionText: input.questionText,
      questionType: input.questionType,
      positiveMarks: input.positiveMarks,
      negativeMarks: input.negativeMarks,
      explanation: input.explanation,
      durationSeconds: input.durationSeconds ?? null,
    };

    if (input.questionType === "single_correct_mcq") {
      questionData = {
        ...questionData,
        optionA: input.optionA,
        optionB: input.optionB,
        optionC: input.optionC,
        optionD: input.optionD,
        optionE: input.optionE ?? null,
        correctOption: input.correctOption,
        correctOptions: null,
        numericalAnswer: null,
        numericalTolerance: null,
        matchData: null,
        paragraphText: null,
      };
    } else if (input.questionType === "multiple_correct_mcq") {
      questionData = {
        ...questionData,
        optionA: input.optionA,
        optionB: input.optionB,
        optionC: input.optionC,
        optionD: input.optionD,
        optionE: input.optionE ?? null,
        correctOptions: input.correctOptions,
        partialMarking: input.partialMarking,
        correctOption: null,
        numericalAnswer: null,
        numericalTolerance: null,
        matchData: null,
        paragraphText: null,
      };
    } else if (input.questionType === "numerical") {
      questionData = {
        ...questionData,
        numericalAnswer: input.numericalAnswer,
        numericalTolerance: input.numericalTolerance,
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
    } else if (input.questionType === "match_the_following") {
      questionData = {
        ...questionData,
        matchData: input.matchData,
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctOption: null,
        correctOptions: null,
        optionE: null,
        numericalAnswer: null,
        numericalTolerance: null,
        paragraphText: null,
      };
    } else if (input.questionType === "comprehension") {
      questionData = {
        ...questionData,
        paragraphText: input.paragraphText,
        optionA: input.optionA,
        optionB: input.optionB,
        optionC: input.optionC,
        optionD: input.optionD,
        optionE: input.optionE ?? null,
        correctOption: input.correctOption,
        correctOptions: null,
        numericalAnswer: null,
        numericalTolerance: null,
        matchData: null,
      };
    } else if (input.questionType === "assertion_reason") {
      questionData = {
        ...questionData,
        optionA: input.optionA,
        optionB: input.optionB,
        optionC: input.optionC,
        optionD: input.optionD,
        optionE: input.optionE ?? null,
        correctOption: input.correctOption,
        correctOptions: null,
        numericalAnswer: null,
        numericalTolerance: null,
        matchData: null,
        paragraphText: null,
      };
    }

    const newQuestion = await db
      .insertInto("testQuestions")
      .values(questionData)
      .returningAll()
      .executeTakeFirstOrThrow();

        await syncToQuestionBank(effectiveTeacherId, [
      {
        ...questionData,
        subjectName: subjectAndOwner.subjectName,
      },
    ], {
      sourceMockTestId: subjectAndOwner.mockTestId,
      sourceTestItemId: subjectAndOwner.testItemId,
      sourceTestQuestionIds: [newQuestion.id],
    });

        await syncMockTestAggregates(subjectAndOwner.mockTestId).catch(err => console.error("Failed to sync aggregates:", err));

    return new Response(superjson.stringify(newQuestion satisfies OutputType));
  } catch (error) {
    console.error("Error creating question:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: error.issues.map((issue) => issue.message).join(" ") }),
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