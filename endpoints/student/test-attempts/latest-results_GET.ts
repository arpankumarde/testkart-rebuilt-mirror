import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./latest-results_GET.schema";
import superjson from "superjson";


export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can view results." }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const testItemIdStr = url.searchParams.get("testItemId");
    if (!testItemIdStr) {
      return new Response(
        superjson.stringify({ error: "testItemId is required." }),
        { status: 400 }
      );
    }
    const testItemId = parseInt(testItemIdStr, 10);
    if (isNaN(testItemId)) {
      return new Response(
        superjson.stringify({ error: "Invalid testItemId." }),
        { status: 400 }
      );
    }

    // 1. Fetch test item info (isFree, mockTestId, testPackageTitle)
    const testItemInfo = await db
      .selectFrom("mockTestItems")
      .innerJoin("mockTests", "mockTests.id", "mockTestItems.packageId")
      .select([
        "mockTestItems.isFree",
        "mockTests.id as mockTestId",
        "mockTests.title as testPackageTitle",
      ])
      .where("mockTestItems.id", "=", testItemId)
      .executeTakeFirst();

    if (!testItemInfo) {
      return new Response(
        superjson.stringify({ error: "Test item not found." }),
        { status: 404 }
      );
    }

    // 2. If not free, verify student enrollment via mockTestEnrollments
    if (!testItemInfo.isFree) {
      const enrollmentRecord = await db
        .selectFrom("mockTestEnrollments")
        .select("id")
        .where("mockTestEnrollments.mockTestId", "=", testItemInfo.mockTestId)
        .where("mockTestEnrollments.studentId", "=", user.id)
        .executeTakeFirst();

      if (!enrollmentRecord) {
        return new Response(
          superjson.stringify({ error: "You are not enrolled in this test." }),
          { status: 403 }
        );
      }
    }

    const enrollmentCheck = {
      mockTestId: testItemInfo.mockTestId,
      testPackageTitle: testItemInfo.testPackageTitle,
    };

    // 2. Get the latest completed attempt for this test item
    const latestAttempt = await db
      .selectFrom("testAttempts")
      .selectAll()
      .where("testId", "=", testItemId)
      .where("studentId", "=", user.id)
      .where("completedAt", "is not", null)
      .orderBy("completedAt", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!latestAttempt || !latestAttempt.completedAt) {
      return new Response(
        superjson.stringify({ error: "No completed attempts found for this test." }),
        { status: 404 }
      );
    }

    // 3. Get all questions for this test item (ordered to match test portal ordering)
    const allQuestions = await db
      .selectFrom("testQuestions")
      .leftJoin(
        "testItemSubjects",
        "testQuestions.subjectId",
        "testItemSubjects.id"
      )
      .select([
        "testQuestions.id as questionId",
        "testQuestions.questionText",
        "testQuestions.questionType",
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
        "testQuestions.paragraphText",
        "testQuestions.positiveMarks",
        "testQuestions.negativeMarks",
        "testQuestions.partialMarking",
        "testQuestions.explanation",
      ])
      .where("testQuestions.testId", "=", testItemId)
      .orderBy("testItemSubjects.orderIndex", "asc")
      .orderBy("testQuestions.id", "asc")
      .execute();

    // 4. Get all student answers for this attempt
    const studentAnswers = await db
      .selectFrom("testAttemptAnswers")
      .select([
        "questionId",
        "selectedOption",
        "selectedOptions",
        "numericalAnswer",
        "matchAnswers",
        "isCorrect",
        "marksObtained",
      ])
      .where("testAttemptId", "=", latestAttempt.id)
      .execute();

    // 5. Create a map of answers by questionId for easy lookup
    const answersMap = new Map(
      studentAnswers.map(answer => [answer.questionId, answer])
    );

    // 6. Combine questions with answers (null for unattempted questions)
    const resultsData = allQuestions.map(question => {
      const answer = answersMap.get(question.questionId);
      return {
        questionId: question.questionId,
        questionText: question.questionText,
        questionType: question.questionType,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        optionE: question.optionE,
        correctOption: question.correctOption,
        correctOptions: question.correctOptions,
        correctNumericalAnswer: question.numericalAnswer ? Number(question.numericalAnswer) : null,
        numericalTolerance: question.numericalTolerance ? Number(question.numericalTolerance) : null,
        matchData: question.matchData ? (question.matchData as { correctMatches: Record<string, string> }) : null,
        paragraphText: question.paragraphText,
        positiveMarks: question.positiveMarks ? Number(question.positiveMarks) : null,
        negativeMarks: question.negativeMarks ? Number(question.negativeMarks) : null,
        partialMarking: question.partialMarking,
        explanation: question.explanation,
        selectedOption: answer?.selectedOption ?? null,
        selectedOptions: answer?.selectedOptions ?? null,
        studentNumericalAnswer: answer?.numericalAnswer ? Number(answer.numericalAnswer) : null,
        matchAnswers: answer?.matchAnswers ? (answer.matchAnswers as Record<string, string>) : null,
        isCorrect: answer?.isCorrect ?? null,
        marksObtained: answer?.marksObtained ? Number(answer.marksObtained) : 0,
      };
    });

    const timeTaken = Math.round(
      (latestAttempt.completedAt.getTime() - (latestAttempt.startedAt?.getTime() ?? latestAttempt.completedAt.getTime())) / 1000
    );

    const correctAnswers = resultsData.filter(r => r.isCorrect === true).length;
    
    // Calculate totalMarks and maxPossibleMarks
    const totalMarks = resultsData.reduce((sum, r) => sum + r.marksObtained, 0);
    const maxPossibleMarks = allQuestions.reduce((sum, q) => {
      const marks = q.positiveMarks ? Number(q.positiveMarks) : 0;
      return sum + marks;
    }, 0);

    const response: OutputType = {
      attemptId: latestAttempt.id,
      score: parseFloat(latestAttempt.score ?? "0"),
      totalMarks: parseFloat(totalMarks.toFixed(2)),
      maxPossibleMarks,
      correctAnswers,
      // Use the actual number of returned result rows, not the test item's
      // declared totalQuestions config. Those two can legitimately diverge
      // (a teacher can add more questions to the bank than they originally
      // declared), and maxPossibleMarks/results below are already built
      // from the full bank — mixing in the stale declared count here caused
      // "not attempted" math to go negative when the bank had grown past
      // the declared total. This also matches how the immediate post-submit
      // view (submit-attempt_POST.ts) reports totalQuestions.
      totalQuestions: resultsData.length,
      timeTaken,
      completedAt: latestAttempt.completedAt,
      mockTestId: enrollmentCheck.mockTestId,
      testPackageTitle: enrollmentCheck.testPackageTitle,
      results: resultsData,
    };

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Error fetching latest test results:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch results.", details: errorMessage }),
      { status: 500 }
    );
  }
}