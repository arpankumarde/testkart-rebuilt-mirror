import { db } from "./db";
import {
  scoreQuestion,
  calculateMaxPossibleMarksWithLimits,
  StudentAnswer,
  QuestionDataWithLimits,
} from "./testScoringLogic";
import { QuestionData } from "./questionTypes";
import type { AttemptProgressState } from "./testAttemptProgressState";
import type {
  InputType as SubmitInput,
  OutputType as SubmitOutput,
} from "../endpoints/student/test-item/submit-attempt_POST.schema";

/**
 * Scoring and closing of a test attempt, shared by student submit-attempt and
 * the server-side close of live attempts that were never submitted, so both
 * score and store answers the same way.
 */

export type SubmittedAnswer = SubmitInput["answers"][number];
export type AttemptQuestionResult = SubmitOutput["results"][number];

export type ScoringQuestion = QuestionDataWithLimits & {
  subjectName: string | null;
  sectionName: string | null;
};

export type AttemptAnswerRow = {
  testAttemptId: number;
  questionId: number;
  selectedOption: string | null;
  selectedOptions: string[] | null;
  numericalAnswer: number | null;
  matchAnswers: Record<string, string> | null;
  isCorrect: boolean;
  marksObtained: number;
};

export type ScoredAttempt = {
  percentageScore: number;
  totalMarksObtained: number;
  maxPossibleMarks: number;
  correctAnswersCount: number;
  results: AttemptQuestionResult[];
  answerRows: AttemptAnswerRow[];
};

/** The paper's questions in scoring order, with subject and section attempt limits. */
export async function loadScoringQuestions(testId: number): Promise<ScoringQuestion[]> {
  const rows = await db
    .selectFrom("testQuestions")
    .leftJoin("testItemSubjects", "testQuestions.subjectId", "testItemSubjects.id")
    .leftJoin("subjectSections", "testQuestions.sectionId", "subjectSections.id")
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
    .where("testQuestions.testId", "=", testId)
    .orderBy("testItemSubjects.orderIndex", "asc")
    .orderBy("testQuestions.id", "asc")
    .execute();

  return rows.map((q) => ({
    ...q,
    questionType: q.questionType as QuestionData["questionType"],
  }));
}

type AttemptLimitGroup = {
  kind: "section" | "subject";
  name: string;
  limit: number;
  questionIds: number[];
};

// A subject with sections limits each section (unsectioned questions are free);
// a subject without sections limits the subject as a whole.
function attemptLimitGroups(questions: ScoringQuestion[]): AttemptLimitGroup[] {
  const bySubject = new Map<number | null, ScoringQuestion[]>();
  for (const q of questions) {
    if (!bySubject.has(q.subjectId)) bySubject.set(q.subjectId, []);
    bySubject.get(q.subjectId)!.push(q);
  }

  const groups: AttemptLimitGroup[] = [];
  for (const [, subjectQs] of bySubject) {
    if (subjectQs.some((q) => q.sectionId !== null)) {
      const bySection = new Map<number, ScoringQuestion[]>();
      for (const q of subjectQs) {
        if (q.sectionId === null) continue;
        if (!bySection.has(q.sectionId)) bySection.set(q.sectionId, []);
        bySection.get(q.sectionId)!.push(q);
      }
      for (const [, sectionQs] of bySection) {
        const limit = sectionQs[0].sectionMaxAttemptsAllowed;
        if (limit === null) continue;
        groups.push({
          kind: "section",
          name: sectionQs[0].sectionName ?? "Unknown Section",
          limit,
          questionIds: sectionQs.map((q) => q.id),
        });
      }
    } else {
      const limit = subjectQs[0].subjectMaxAttemptsAllowed;
      if (limit === null) continue;
      groups.push({
        kind: "subject",
        name: subjectQs[0].subjectName ?? "Unknown Subject",
        limit,
        questionIds: subjectQs.map((q) => q.id),
      });
    }
  }
  return groups;
}

/** The first subject or section answered past its attempt limit, as a message, or null. */
export function findAttemptLimitError(questions: ScoringQuestion[], answers: SubmittedAnswer[]): string | null {
  const answered = new Set(answers.map((a) => a.questionId));
  for (const group of attemptLimitGroups(questions)) {
    const count = group.questionIds.filter((id) => answered.has(id)).length;
    if (count > group.limit) {
      return `Too many questions answered in ${group.kind} ${group.name}. Maximum allowed: ${group.limit}.`;
    }
  }
  return null;
}

/** Drops answers past a subject or section limit, keeping the earliest questions in paper order. */
export function trimToAttemptLimits(questions: ScoringQuestion[], answers: SubmittedAnswer[]): SubmittedAnswer[] {
  const answered = new Set(answers.map((a) => a.questionId));
  const dropped = new Set<number>();
  for (const group of attemptLimitGroups(questions)) {
    group.questionIds.filter((id) => answered.has(id)).slice(group.limit).forEach((id) => dropped.add(id));
  }
  return dropped.size === 0 ? answers : answers.filter((a) => !dropped.has(a.questionId));
}

/** Answers from the web player's saved state, in the shape submit-attempt takes. */
export function answersFromProgressState(state: AttemptProgressState): SubmittedAnswer[] {
  return state.answers.map(([questionId, saved]): SubmittedAnswer => {
    switch (saved.type) {
      case "single":
        return { questionId, answerType: "single", selectedOption: saved.value };
      case "multiple":
        return { questionId, answerType: "multiple", selectedOptions: saved.value };
      case "numerical":
        return { questionId, answerType: "numerical", numericalAnswer: saved.value };
      case "match":
        return { questionId, answerType: "match", matchAnswers: saved.value };
    }
  });
}

function toStudentAnswer(a: SubmittedAnswer): StudentAnswer {
  switch (a.answerType) {
    case "single":
      return { answerType: "single", selectedOption: a.selectedOption };
    case "multiple":
      return { answerType: "multiple", selectedOptions: Array.from(new Set(a.selectedOptions)) };
    case "numerical":
      return { answerType: "numerical", numericalAnswer: a.numericalAnswer };
    case "match":
      return { answerType: "match", matchAnswers: a.matchAnswers };
  }
}

/** Scores every question on the paper; unanswered ones score 0 and get no answer row. */
export function scoreAttempt(
  attemptId: number,
  questions: ScoringQuestion[],
  answers: SubmittedAnswer[]
): ScoredAttempt {
  const answersMap = new Map<number, StudentAnswer>(answers.map((a) => [a.questionId, toStudentAnswer(a)]));
  const maxPossibleMarks = calculateMaxPossibleMarksWithLimits(questions);

  let correctAnswersCount = 0;
  let totalMarksObtained = 0;
  const results: AttemptQuestionResult[] = [];
  const answerRows: AttemptAnswerRow[] = [];

  for (const question of questions) {
    const studentAnswer = answersMap.get(question.id);
    const scoring = scoreQuestion(question, studentAnswer);

    if (scoring.isCorrect) correctAnswersCount++;
    totalMarksObtained += scoring.marksObtained;

    const result: AttemptQuestionResult = {
      questionId: question.id,
      questionType: question.questionType as AttemptQuestionResult["questionType"],
      isCorrect: scoring.isCorrect,
      marksObtained: scoring.marksObtained,
      correctOption: question.correctOption,
      selectedOption: null,
      correctOptions: question.correctOptions,
      selectedOptions: null,
      correctNumericalAnswer: question.numericalAnswer ? Number(question.numericalAnswer) : null,
      studentNumericalAnswer: null,
      numericalTolerance: question.numericalTolerance ? Number(question.numericalTolerance) : null,
      matchData: question.matchData ? (question.matchData as { correctMatches: Record<string, string> }) : null,
      matchAnswers: null,
      explanation: question.explanation,
    };

    if (studentAnswer) {
      const row: AttemptAnswerRow = {
        testAttemptId: attemptId,
        questionId: question.id,
        selectedOption: null,
        selectedOptions: null,
        numericalAnswer: null,
        matchAnswers: null,
        // An answer was given, so scoreQuestion never returned the "not attempted" null.
        isCorrect: scoring.isCorrect ?? false,
        marksObtained: scoring.marksObtained,
      };

      if (studentAnswer.answerType === "single") {
        result.selectedOption = row.selectedOption = studentAnswer.selectedOption;
      } else if (studentAnswer.answerType === "multiple") {
        result.selectedOptions = row.selectedOptions = studentAnswer.selectedOptions;
      } else if (studentAnswer.answerType === "numerical") {
        result.studentNumericalAnswer = row.numericalAnswer = studentAnswer.numericalAnswer;
      } else if (studentAnswer.answerType === "match") {
        result.matchAnswers = row.matchAnswers = studentAnswer.matchAnswers;
      }

      answerRows.push(row);
    }

    results.push(result);
  }

  const percentageScore = maxPossibleMarks > 0 ? (totalMarksObtained / maxPossibleMarks) * 100 : 0;

  return { percentageScore, totalMarksObtained, maxPossibleMarks, correctAnswersCount, results, answerRows };
}

/**
 * Closes the attempt with its score and answers in one transaction. Returns
 * false, writing nothing, when the attempt was already closed.
 */
export async function closeScoredAttempt(
  attemptId: number,
  completedAt: Date,
  scored: ScoredAttempt
): Promise<boolean> {
  try {
    await db.transaction().execute(async (trx) => {
      // Close the attempt first; a second close racing this one updates no
      // row and rolls back instead of recording its answers too.
      const closed = await trx
        .updateTable("testAttempts")
        .set({ completedAt, score: scored.percentageScore.toFixed(2) })
        .where("id", "=", attemptId)
        .where("completedAt", "is", null)
        .executeTakeFirst();

      if (Number(closed.numUpdatedRows) === 0) {
        throw new AttemptAlreadyClosedError();
      }

      // Saved web player state is not needed once the attempt is closed.
      await trx.deleteFrom("testAttemptProgress").where("attemptId", "=", attemptId).execute();

      if (scored.answerRows.length > 0) {
        await trx.insertInto("testAttemptAnswers").values(scored.answerRows).execute();
      }
    });
    return true;
  } catch (error) {
    if (error instanceof AttemptAlreadyClosedError) return false;
    throw error;
  }
}

class AttemptAlreadyClosedError extends Error {
  constructor() {
    super("This test has already been submitted.");
  }
}
