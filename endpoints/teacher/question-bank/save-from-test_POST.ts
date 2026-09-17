import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./save-from-test_POST.schema";
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

    // Fetch the test questions checking for deep ownership and retrieving useful pre-fill context
    const testQs = await db
      .selectFrom("testQuestions")
      .leftJoin("testItemSubjects", "testQuestions.subjectId", "testItemSubjects.id")
      .innerJoin("mockTestItems", "testQuestions.testId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .selectAll("testQuestions")
      .select([
        "mockTests.teacherId", 
        "testItemSubjects.subjectName as fetchedSubjectName", 
        "mockTests.examId",
        "mockTests.id as mockTestId"
      ])
      .where("testQuestions.id", "in", input.questionIds)
      .execute();

    // A team manager's questions belong to the academy they manage.
    const ownedQs = testQs.filter(q => q.teacherId === effectiveTeacherId);

    if (ownedQs.length === 0) {
      return new Response(superjson.stringify({ success: true, savedCount: 0 }));
    }

    const newBankQs = ownedQs.map((q) => ({
      teacherId: effectiveTeacherId,
      questionText: q.questionText,
      questionType: q.questionType,
      positiveMarks: q.positiveMarks,
      negativeMarks: q.negativeMarks,
      explanation: q.explanation,
      durationSeconds: q.durationSeconds,
      correctOption: q.correctOption,
      correctOptions: q.correctOptions,
      numericalAnswer: q.numericalAnswer,
      numericalTolerance: q.numericalTolerance,
      matchData: q.matchData,
      paragraphText: q.paragraphText,
      partialMarking: q.partialMarking,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      subjectName: q.fetchedSubjectName,
      examId: q.examId,
      sourceMockTestId: q.mockTestId,
    }));

    await db.insertInto("questionBank").values(newBankQs).execute();

    return new Response(
      superjson.stringify({ 
        success: true, 
        savedCount: newBankQs.length 
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred" }), { status: 500 });
  }
}