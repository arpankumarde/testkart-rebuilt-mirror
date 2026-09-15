import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./create_POST.schema";
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

    let questionData: any = {
      teacherId: effectiveTeacherId,
      questionText: input.questionText,
      questionType: input.questionType,
      positiveMarks: input.positiveMarks,
      negativeMarks: input.negativeMarks,
      explanation: input.explanation,
      durationSeconds: input.durationSeconds ?? null,
      tags: input.tags ?? null,
      subjectName: input.subjectName ?? null,
      examId: input.examId ?? null,
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
      };
    } else if (input.questionType === "numerical") {
      questionData = {
        ...questionData,
        numericalAnswer: input.numericalAnswer,
        numericalTolerance: input.numericalTolerance,
      };
    } else if (input.questionType === "match_the_following") {
      questionData = {
        ...questionData,
        matchData: input.matchData,
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
      };
    }

    const newQuestion = await db
      .insertInto("questionBank")
      .values(questionData)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(newQuestion satisfies OutputType));
  } catch (error) {
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred" }), { status: 500 });
  }
}