import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./submit-attempt_POST.schema";
import {
  closeScoredAttempt,
  findAttemptLimitError,
  loadScoringQuestions,
  scoreAttempt,
} from "../../../helpers/testAttemptScoring";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import { sendEmail } from "../../../helpers/sendEmail";
import {
  attemptStartedInLiveWindow,
  getLiveTestForTestItem,
  isEnrolledInLiveTest,
  liveTestResultsReleased,
  liveTestWindowError,
} from "../../../helpers/liveTestAttemptWindow";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can submit a test." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const attempt = await db
      .selectFrom("testAttempts")
      .selectAll()
      .where("id", "=", input.attemptId)
      .executeTakeFirst();

    if (!attempt) {
      return new Response(
        superjson.stringify({ error: "Test attempt not found." }),
        { status: 404 }
      );
    }

    if (attempt.studentId !== user.id) {
      return new Response(
        superjson.stringify({ error: "You do not own this test attempt." }),
        { status: 403 }
      );
    }

    if (attempt.completedAt) {
      return new Response(
        superjson.stringify({ error: "This test has already been submitted." }),
        { status: 400 }
      );
    }

    // A live test paper only takes submissions from enrolled students, for an
    // attempt started during the live test, until submissions close.
    const liveTestPaper = await getLiveTestForTestItem(attempt.testId);
    if (liveTestPaper) {
      if (!(await isEnrolledInLiveTest(user.id, liveTestPaper.liveTestId))) {
        return new Response(
          superjson.stringify({ error: "You are not enrolled in this live test." }),
          { status: 403 }
        );
      }

      const windowError = liveTestWindowError(liveTestPaper, "continue");
      if (windowError) {
        return new Response(superjson.stringify({ error: windowError }), { status: 403 });
      }

      if (!attemptStartedInLiveWindow(attempt.startedAt, liveTestPaper)) {
        return new Response(
          superjson.stringify({ error: "This attempt was not started during the live test." }),
          { status: 403 }
        );
      }
    }

    const questions = await loadScoringQuestions(attempt.testId);

    const limitError = findAttemptLimitError(questions, input.answers);
    if (limitError) {
      return new Response(superjson.stringify({ error: limitError }), { status: 400 });
    }

    const scored = scoreAttempt(input.attemptId, questions, input.answers);
    const { percentageScore, totalMarksObtained, maxPossibleMarks, correctAnswersCount, results } = scored;

    const completedAt = new Date();
    const timeTakenSeconds = attempt.startedAt
      ? Math.round((completedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000)
      : 0;

    if (!(await closeScoredAttempt(input.attemptId, completedAt, scored))) {
      return new Response(
        superjson.stringify({ error: "This test has already been submitted." }),
        { status: 400 }
      );
    }

    // Send test completion email notification
    try {
      const student = await db
        .selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", user.id)
        .executeTakeFirst();

      if (student?.email) {
        const testItem = await db
          .selectFrom("mockTestItems")
          .select("title")
          .where("id", "=", attempt.testId)
          .executeTakeFirst();

        if (testItem) {
          const template = emailTemplatesExtra.testCompleted(
            student.displayName,
            testItem.title,
            parseFloat(percentageScore.toFixed(2)),
            parseFloat(totalMarksObtained.toFixed(2)),
            maxPossibleMarks,
            correctAnswersCount,
            questions.length
          );
          await sendEmail({ to: student.email as string, ...template });
        }
      }
    } catch (err) {
      console.error("Failed to send testCompleted email:", err);
    }

    // Until a live test's submissions close, hide everything that would reveal
    // the answer key, per-question correctness included. Totals stay.
    const hideAnswers = liveTestPaper !== null && !liveTestResultsReleased(liveTestPaper);
    const visibleResults = hideAnswers
      ? results.map((result) => ({
          ...result,
          isCorrect: null,
          marksObtained: 0,
          correctOption: null,
          correctOptions: null,
          correctNumericalAnswer: null,
          numericalTolerance: null,
          matchData: null,
          explanation: null,
        }))
      : results;

    return new Response(
      superjson.stringify({
        score: parseFloat(percentageScore.toFixed(2)),
        totalMarks: parseFloat(totalMarksObtained.toFixed(2)),
        maxPossibleMarks,
        totalQuestions: questions.length,
        correctAnswers: correctAnswersCount,
        timeTakenSeconds,
        results: visibleResults,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error submitting test attempt:", error);
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
