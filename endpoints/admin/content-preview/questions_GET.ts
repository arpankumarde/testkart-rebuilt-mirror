import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./questions_GET.schema";

const toNumber = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);
  } catch {
    return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const parsed = schema.safeParse({ testItemId: url.searchParams.get("testItemId") });
    if (!parsed.success) {
      return new Response(superjson.stringify({ error: "Invalid test id" }), { status: 400 });
    }

    const rows = await db
      .selectFrom("testQuestions")
      .leftJoin("testItemSubjects", "testItemSubjects.id", "testQuestions.subjectId")
      .select([
        "testQuestions.id",
        "testQuestions.questionType",
        "testQuestions.questionText",
        "testQuestions.paragraphText",
        "testQuestions.optionA",
        "testQuestions.optionB",
        "testQuestions.optionC",
        "testQuestions.optionD",
        "testQuestions.optionE",
        "testQuestions.correctOption",
        "testQuestions.correctOptions",
        "testQuestions.numericalAnswer",
        "testQuestions.numericalTolerance",
        "testQuestions.matchData",
        "testQuestions.explanation",
        "testQuestions.positiveMarks",
        "testQuestions.negativeMarks",
        "testQuestions.isAiGenerated",
        "testItemSubjects.subjectName",
      ])
      .where("testQuestions.testId", "=", parsed.data.testItemId)
      .orderBy("testItemSubjects.orderIndex", "asc")
      .orderBy("testQuestions.orderIndex", "asc")
      .orderBy("testQuestions.id", "asc")
      .execute();

    const output: OutputType = {
      questions: rows.map((row) => ({
        ...row,
        questionType: row.questionType ?? "single_correct_mcq",
        numericalAnswer: toNumber(row.numericalAnswer),
        numericalTolerance: toNumber(row.numericalTolerance),
        positiveMarks: toNumber(row.positiveMarks),
        negativeMarks: toNumber(row.negativeMarks),
        isAiGenerated: !!row.isAiGenerated,
        subjectName: row.subjectName ?? null,
      })),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error loading preview questions:", error);
    return new Response(superjson.stringify({ error: "Could not load the questions" }), { status: 500 });
  }
}