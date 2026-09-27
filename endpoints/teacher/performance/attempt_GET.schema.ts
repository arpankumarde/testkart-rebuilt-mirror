import { z } from "zod";
import superjson from "superjson";
import type { AttemptMarks } from "../../../helpers/teacherPerformance";

const id = z.coerce.number().int().positive();

/** attemptId picks one attempt; without it the student's best finished attempt opens. */
export const schema = z.object({ studentId: id, itemId: id, attemptId: id.optional() });

export type InputType = z.infer<typeof schema>;

export type TranscriptStatus = "correct" | "wrong" | "partial" | "skipped";

/** The answer fields TestResultQuestionRenderer reads, kept here so the backend does not import a component. */
type QuestionResultFields = {
  questionType:
    | "single_correct_mcq"
    | "multiple_correct_mcq"
    | "numerical"
    | "assertion_reason"
    | "comprehension"
    | "match_the_following";
  marksObtained: number;
  correctOption: string | null;
  selectedOption: string | null;
  correctOptions: string[] | null;
  selectedOptions: string[] | null;
  correctNumericalAnswer: number | null;
  studentNumericalAnswer: number | null;
  numericalTolerance: number | null;
  matchData: { leftItems?: string[]; rightItems?: string[]; correctMatches: Record<string, string> } | null;
  matchAnswers: Record<string, string> | null;
  explanation: string | null;
};

export type TranscriptAttempt = {
  attemptId: number;
  number: number;
  startedAt: Date | null;
  completedAt: Date | null;
  score: number | null;
  marks: AttemptMarks | null;
  timeTakenMinutes: number | null;
  isBest: boolean;
};

export type TranscriptQuestion = QuestionResultFields & {
  number: number;
  questionId: number;
  subjectName: string | null;
  questionText: string;
  paragraphText: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
  status: TranscriptStatus;
  positiveMarks: number;
  negativeMarks: number;
};

export type TranscriptCounts = { correct: number; wrong: number; partial: number; skipped: number };

export type TranscriptSubject = TranscriptCounts &
  AttemptMarks & {
    name: string;
    total: number;
    maxMarks: number;
  };

export type OutputType = {
  student: { id: number; name: string; avatarUrl: string | null };
  paper: { itemId: number; title: string; seriesTitle: string; isLiveTest: boolean; maxMarks: number };
  attempts: TranscriptAttempt[];
  attempt: TranscriptAttempt & { finished: boolean; counts: TranscriptCounts; marks: AttemptMarks };
  subjects: TranscriptSubject[];
  questions: TranscriptQuestion[];
};

export const getTeacherPerformanceAttempt = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ studentId: String(query.studentId), itemId: String(query.itemId) });
  if (query.attemptId) params.set("attemptId", String(query.attemptId));
  const result = await fetch(`/_api/teacher/performance/attempt?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};