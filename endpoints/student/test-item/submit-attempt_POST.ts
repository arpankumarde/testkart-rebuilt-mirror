import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./submit-attempt_POST.schema";
import {
  scoreQuestion,
  calculateMaxPossibleMarksWithLimits,
  StudentAnswer,
  QuestionDataWithLimits,
} from "../../../helpers/testScoringLogic";
import { QuestionData } from "../../../helpers/questionTypes";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import { sendEmail } from "../../../helpers/sendEmail";
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

    // Fetch questions with subject and section data for limit enforcement and scoring
    const questionsFromDb = await db
      .selectFrom("testQuestions")
      .leftJoin(
        "testItemSubjects",
        "testQuestions.subjectId",
        "testItemSubjects.id"
      )
      .leftJoin(
        "subjectSections",
        "testQuestions.sectionId",
        "subjectSections.id"
      )
      .select([
        "testQuestions.id",
        "testQuestions.questionType",
        "testQuestions.correctOption",
        "testQuestions.correctOptions",
        "testQuestions.numericalAnswer",
        "testQuestions.numericalTolerance",
        "testQuestions.matchData",
        "testQuestions.positiveMarks",
        "testQuestions.negativeMarks",
        "testQuestions.partialMarking",
        "testQuestions.explanation",
        "testQuestions.subjectId",
        "testQuestions.sectionId",
        "testItemSubjects.subjectName",
        "testItemSubjects.maxAttemptsAllowed as subjectMaxAttemptsAllowed",
        "subjectSections.sectionName",
        "subjectSections.maxAttemptsAllowed as sectionMaxAttemptsAllowed",
      ])
      .where("testQuestions.testId", "=", attempt.testId)
      .orderBy("testItemSubjects.orderIndex", "asc")
      .orderBy("testQuestions.id", "asc")
      .execute();

    // Build a set of answered question IDs for limit validation
    const answeredQuestionIds = new Set(input.answers.map((a) => a.questionId));

    // Validate attempt limits: group by subjectId, check section/subject limits
    // Group questions by subjectId
    const bySubject = new Map<
      number | null,
      typeof questionsFromDb
    >();
    for (const q of questionsFromDb) {
      const subjectKey = q.subjectId;
      if (!bySubject.has(subjectKey)) {
        bySubject.set(subjectKey, []);
      }
      bySubject.get(subjectKey)!.push(q);
    }

    for (const [, subjectQs] of bySubject) {
      const hasSections = subjectQs.some((q) => q.sectionId !== null);

      if (hasSections) {
        // Group by sectionId
        const bySection = new Map<number | null, typeof questionsFromDb>();
        for (const q of subjectQs) {
          if (q.sectionId === null) continue; // unsectioned questions have no section limit
          if (!bySection.has(q.sectionId)) {
            bySection.set(q.sectionId, []);
          }
          bySection.get(q.sectionId)!.push(q);
        }

        for (const [, sectionQs] of bySection) {
          const limit = sectionQs[0].sectionMaxAttemptsAllowed;
          if (limit === null) continue;

          const answeredInSection = sectionQs.filter((q) =>
            answeredQuestionIds.has(q.id)
          ).length;

          if (answeredInSection > limit) {
            const sectionName = sectionQs[0].sectionName ?? "Unknown Section";
            return new Response(
              superjson.stringify({
                error: `Too many questions answered in section ${sectionName}. Maximum allowed: ${limit}.`,
              }),
              { status: 400 }
            );
          }
        }
      } else {
        // No sections — check subject limit
        const limit = subjectQs.length > 0 ? subjectQs[0].subjectMaxAttemptsAllowed : null;
        if (limit !== null) {
          const answeredInSubject = subjectQs.filter((q) =>
            answeredQuestionIds.has(q.id)
          ).length;

          if (answeredInSubject > limit) {
            const subjectName = subjectQs[0].subjectName ?? "Unknown Subject";
            return new Response(
              superjson.stringify({
                error: `Too many questions answered in subject ${subjectName}. Maximum allowed: ${limit}.`,
              }),
              { status: 400 }
            );
          }
        }
      }
    }

    // Cast to QuestionData type for scoring logic
    const questions: QuestionData[] = questionsFromDb.map((q) => ({
      id: q.id,
      questionType: q.questionType as QuestionData["questionType"],
      correctOption: q.correctOption,
      correctOptions: q.correctOptions,
      numericalAnswer: q.numericalAnswer,
      numericalTolerance: q.numericalTolerance,
      positiveMarks: q.positiveMarks,
      negativeMarks: q.negativeMarks,
      partialMarking: q.partialMarking,
      matchData: q.matchData,
      explanation: q.explanation,
    }));

    // Build enhanced questions with limit fields for max marks calculation
    const questionsWithLimits: QuestionDataWithLimits[] = questionsFromDb.map((q) => ({
      id: q.id,
      questionType: q.questionType as QuestionData["questionType"],
      correctOption: q.correctOption,
      correctOptions: q.correctOptions,
      numericalAnswer: q.numericalAnswer,
      numericalTolerance: q.numericalTolerance,
      positiveMarks: q.positiveMarks,
      negativeMarks: q.negativeMarks,
      partialMarking: q.partialMarking,
      matchData: q.matchData,
      explanation: q.explanation,
      subjectId: q.subjectId,
      sectionId: q.sectionId,
      subjectMaxAttemptsAllowed: q.subjectMaxAttemptsAllowed,
      sectionMaxAttemptsAllowed: q.sectionMaxAttemptsAllowed,
    }));

    // Create a Map from input.answers for efficient lookup
    const answersMap = new Map<number, StudentAnswer>(
      input.answers.map((a) => {
        let studentAnswer: StudentAnswer;

        switch (a.answerType) {
          case "single":
            studentAnswer = {
              answerType: "single",
              selectedOption: a.selectedOption,
            };
            break;
          case "multiple":
            studentAnswer = {
              answerType: "multiple",
              selectedOptions: a.selectedOptions,
            };
            break;
          case "numerical":
            studentAnswer = {
              answerType: "numerical",
              numericalAnswer: a.numericalAnswer,
            };
            break;
          case "match":
            studentAnswer = {
              answerType: "match",
              matchAnswers: a.matchAnswers,
            };
            break;
        }

        return [a.questionId, studentAnswer];
      })
    );

    let correctAnswersCount = 0;
    let totalMarksObtained = 0;
    const results: OutputType["results"] = [];
    const answeredQuestions: Array<{
      testAttemptId: number;
      questionId: number;
      selectedOption: string | null;
      selectedOptions: string[] | null;
      numericalAnswer: number | null;
      matchAnswers: Record<string, string> | null;
      isCorrect: boolean;
      marksObtained: number;
    }> = [];

    // Calculate max possible marks respecting subject/section attempt limits
    const maxPossibleMarks = calculateMaxPossibleMarksWithLimits(questionsWithLimits);

    // Loop through ALL questions (preserving question order)
    for (const question of questions) {
      const studentAnswer = answersMap.get(question.id);
      const scoringResult = scoreQuestion(question, studentAnswer);

      if (scoringResult.isCorrect) {
        correctAnswersCount++;
      }
      totalMarksObtained += scoringResult.marksObtained;

      // Build result object
      const result: OutputType["results"][0] = {
        questionId: question.id,
        questionType:
          question.questionType as OutputType["results"][0]["questionType"],
        isCorrect: scoringResult.isCorrect,
        marksObtained: scoringResult.marksObtained,
        correctOption: question.correctOption,
        selectedOption: null,
        correctOptions: question.correctOptions,
        selectedOptions: null,
        correctNumericalAnswer: question.numericalAnswer
          ? Number(question.numericalAnswer)
          : null,
        studentNumericalAnswer: null,
        numericalTolerance: question.numericalTolerance
          ? Number(question.numericalTolerance)
          : null,
        matchData: question.matchData
          ? (question.matchData as { correctMatches: Record<string, string> })
          : null,
        matchAnswers: null,
        explanation: question.explanation,
      };

      // Populate student's answer in the result
      if (studentAnswer) {
        if (studentAnswer.answerType === "single") {
          result.selectedOption = studentAnswer.selectedOption;
        } else if (studentAnswer.answerType === "multiple") {
          result.selectedOptions = studentAnswer.selectedOptions;
        } else if (studentAnswer.answerType === "numerical") {
          result.studentNumericalAnswer = studentAnswer.numericalAnswer;
        } else if (studentAnswer.answerType === "match") {
          result.matchAnswers = studentAnswer.matchAnswers;
        }
      }

      results.push(result);

      // Prepare database insert (only for answered questions)
      if (studentAnswer) {
        const dbAnswer: (typeof answeredQuestions)[0] = {
          testAttemptId: input.attemptId,
          questionId: question.id,
          selectedOption: null,
          selectedOptions: null,
          numericalAnswer: null,
          matchAnswers: null,
          // studentAnswer is truthy here, so scoreQuestion never returned the
          // "not attempted" null case; the DB column stores a real boolean.
          isCorrect: scoringResult.isCorrect ?? false,
          marksObtained: scoringResult.marksObtained,
        };

        if (studentAnswer.answerType === "single") {
          dbAnswer.selectedOption = studentAnswer.selectedOption;
        } else if (studentAnswer.answerType === "multiple") {
          dbAnswer.selectedOptions = studentAnswer.selectedOptions;
        } else if (studentAnswer.answerType === "numerical") {
          dbAnswer.numericalAnswer = studentAnswer.numericalAnswer;
        } else if (studentAnswer.answerType === "match") {
          dbAnswer.matchAnswers = studentAnswer.matchAnswers;
        }

        answeredQuestions.push(dbAnswer);
      }
    }

    // Calculate percentage score
    const percentageScore =
      maxPossibleMarks > 0
        ? (totalMarksObtained / maxPossibleMarks) * 100
        : 0;

    const completedAt = new Date();
    const timeTakenSeconds = attempt.startedAt
      ? Math.round((completedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000)
      : 0;

    await db.transaction().execute(async (trx) => {
      // Insert only answered questions into testAttemptAnswers
      if (answeredQuestions.length > 0) {
        await trx
          .insertInto("testAttemptAnswers")
          .values(answeredQuestions)
          .execute();
      }

      // Update the test attempt with completion time and score
      await trx
        .updateTable("testAttempts")
        .set({
          completedAt,
          score: percentageScore.toFixed(2),
        })
        .where("id", "=", input.attemptId)
        .execute();
    });

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

    return new Response(
      superjson.stringify({
        score: parseFloat(percentageScore.toFixed(2)),
        totalMarks: parseFloat(totalMarksObtained.toFixed(2)),
        maxPossibleMarks,
        totalQuestions: questions.length,
        correctAnswers: correctAnswersCount,
        timeTakenSeconds,
        results,
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