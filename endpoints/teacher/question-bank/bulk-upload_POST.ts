import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
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

    const questionsToInsert = input.questions.map((q) => {
      let questionData: any = {
        teacherId: effectiveTeacherId,
        subjectName: input.subjectName ?? null,
        examId: input.examId ?? null,
        tags: input.tags ?? null,
        questionText: q.questionText,
        questionType: q.questionType,
        positiveMarks: q.positiveMarks,
        negativeMarks: q.negativeMarks,
        explanation: q.explanation ?? null,
        durationSeconds: null,
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
          partialMarking: null,
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
          correctOption: null,
          correctOptions: q.correctOptions,
          partialMarking: q.partialMarking,
          numericalAnswer: null,
          numericalTolerance: null,
          matchData: null,
          paragraphText: null,
        };
      } else if (q.questionType === "numerical") {
        questionData = {
          ...questionData,
          optionA: null,
          optionB: null,
          optionC: null,
          optionD: null,
          optionE: null,
          correctOption: null,
          correctOptions: null,
          partialMarking: null,
          numericalAnswer: q.numericalAnswer,
          numericalTolerance: q.numericalTolerance,
          matchData: null,
          paragraphText: null,
        };
      } else if (q.questionType === "comprehension") {
        questionData = {
          ...questionData,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          optionE: q.optionE ?? null,
          correctOption: q.correctOption,
          correctOptions: null,
          partialMarking: null,
          numericalAnswer: null,
          numericalTolerance: null,
          matchData: null,
          paragraphText: q.paragraphText,
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
          partialMarking: null,
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
        .insertInto("questionBank")
        .values(questionsToInsert)
        .returning(["id"])
        .execute();
    });

    const questionIds = createdQuestions.map((q) => q.id);

    return new Response(
      superjson.stringify({
        count: questionIds.length,
        questionIds,
        message: `${questionIds.length} questions added to question bank successfully.`,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error bulk uploading to question bank:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: "Validation failed", details: error.errors }),
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