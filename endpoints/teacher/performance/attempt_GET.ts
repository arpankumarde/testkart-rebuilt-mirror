import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { Row, get, num, str } from "../../../helpers/teacherAnalyticsTime";
import {
  performanceJson,
  performanceErrorResponse,
  resolvePerformanceTeacher,
  teacherPapersSql,
  answerMarksSql,
  getAttemptMarks,
  paperMaxMarks,
  avatarOrNull,
  round2,
  toNumberOrNull,
  AttemptMarks,
} from "../../../helpers/teacherPerformance";
import {
  schema,
  OutputType,
  TranscriptAttempt,
  TranscriptQuestion,
  TranscriptStatus,
  TranscriptSubject,
} from "./attempt_GET.schema";

/** match_data and match_answers hold either objects or JSON strings. */
const parseJson = <T,>(value: unknown): T | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
};

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolvePerformanceTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const input = schema.parse({
      studentId: url.searchParams.get("studentId") ?? undefined,
      itemId: url.searchParams.get("itemId") ?? undefined,
      attemptId: url.searchParams.get("attemptId") ?? undefined,
    });

    const paperRows = await sql<Row>`${teacherPapersSql(teacherId, sql`mti.id = ${input.itemId}`)}`.execute(db);
    const paper = paperRows.rows[0];
    if (!paper) return performanceJson({ error: "That paper is not one of yours." }, 404);
    const duration = toNumberOrNull(get(paper, "duration_minutes"));

    const user = await db
      .selectFrom("users")
      .select(["id", "displayName", "avatarUrl"])
      .where("id", "=", input.studentId)
      .executeTakeFirst();
    if (!user) return performanceJson({ error: "Student not found." }, 404);

    const attemptRows = await db
      .selectFrom("testAttempts")
      .select(["id", "startedAt", "completedAt", "score"])
      .where("studentId", "=", input.studentId)
      .where("testId", "=", input.itemId)
      .orderBy("startedAt", "asc")
      .orderBy("id", "asc")
      .execute();
    if (attemptRows.length === 0) return performanceJson({ error: "This student has not attempted this paper." }, 404);

    const marks = await getAttemptMarks(attemptRows.map((a) => a.id));
    const attempts: TranscriptAttempt[] = attemptRows.map((a, index) => {
      const started = a.startedAt ? new Date(a.startedAt) : null;
      const completed = a.completedAt ? new Date(a.completedAt) : null;
      const score = completed ? numberOrNull(a.score) : null;
      const rawMinutes = started && completed ? (completed.getTime() - started.getTime()) / 60000 : null;
      return {
        attemptId: a.id,
        number: index + 1,
        startedAt: started,
        completedAt: completed,
        score: round2(score),
        marks: completed ? marks.get(a.id) ?? { gained: 0, lost: 0, net: 0 } : null,
        timeTakenMinutes: round2(rawMinutes === null ? null : duration ? Math.min(rawMinutes, duration) : rawMinutes),
        isBest: false,
      };
    });

    // Best uses the leaderboard rule: highest score, then quickest, then first to finish.
    const best = attempts
      .filter((a) => a.score !== null)
      .sort(
        (a, b) =>
          (b.score as number) - (a.score as number) ||
          (a.timeTakenMinutes ?? Infinity) - (b.timeTakenMinutes ?? Infinity) ||
          (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0)
      )[0];
    if (best) best.isBest = true;
    const selected =
      attempts.find((a) => a.attemptId === input.attemptId) ?? best ?? attempts[attempts.length - 1];

    const questionRows = await db
      .selectFrom("testQuestions")
      .leftJoin("testItemSubjects", "testItemSubjects.id", "testQuestions.subjectId")
      .leftJoin("subjectSections", "subjectSections.id", "testQuestions.sectionId")
      .select([
        "testQuestions.id",
        "testQuestions.testId",
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
        "testQuestions.explanation",
        "testQuestions.subjectId",
        "testQuestions.sectionId",
        "testItemSubjects.subjectName",
        "testItemSubjects.maxAttemptsAllowed as subjectMaxAttemptsAllowed",
        "subjectSections.maxAttemptsAllowed as sectionMaxAttemptsAllowed",
      ])
      .where("testQuestions.testId", "=", input.itemId)
      .orderBy("testItemSubjects.orderIndex", "asc")
      .orderBy("testQuestions.id", "asc")
      .execute();

    const answerRows = await sql<Row>`
      SELECT x.question_id, x.selected_option, x.selected_options, x.numerical_answer, x.match_answers,
             x.is_correct, ${answerMarksSql("x", "q")} AS marks
      FROM test_attempt_answers x
      LEFT JOIN test_questions q ON q.id = x.question_id
      WHERE x.test_attempt_id = ${selected.attemptId}
    `.execute(db);
    const answers = new Map(answerRows.rows.map((row) => [num(get(row, "question_id")), row]));

    const questions: TranscriptQuestion[] = questionRows.map((q, index) => {
      const answer = answers.get(q.id);
      const marksObtained = answer ? round2(Number(get(answer, "marks"))) ?? 0 : 0;
      const isCorrect = answer ? get(answer, "is_correct") === true : null;
      const status: TranscriptStatus = !answer
        ? "skipped"
        : isCorrect
          ? "correct"
          : marksObtained > 0
            ? "partial"
            : "wrong";
      const selectedOptions = answer ? (get(answer, "selected_options") as string[] | null) : null;
      return {
        number: index + 1,
        questionId: q.id,
        subjectName: q.subjectName?.trim() || null,
        questionText: q.questionText,
        paragraphText: q.paragraphText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        optionE: q.optionE,
        questionType: (q.questionType ?? "single_correct_mcq") as TranscriptQuestion["questionType"],
        marksObtained,
        correctOption: q.correctOption,
        selectedOption: answer ? (get(answer, "selected_option") as string | null) : null,
        correctOptions: q.correctOptions,
        selectedOptions: Array.isArray(selectedOptions) ? selectedOptions : null,
        correctNumericalAnswer: numberOrNull(q.numericalAnswer),
        studentNumericalAnswer: answer ? numberOrNull(get(answer, "numerical_answer")) : null,
        numericalTolerance: numberOrNull(q.numericalTolerance),
        matchData: parseJson<TranscriptQuestion["matchData"]>(q.matchData),
        matchAnswers: answer ? parseJson<Record<string, string>>(get(answer, "match_answers")) : null,
        explanation: q.explanation,
        status,
        positiveMarks: numberOrNull(q.positiveMarks) ?? 1,
        negativeMarks: Math.abs(numberOrNull(q.negativeMarks) ?? 0),
      };
    });

    const subjectOrder: string[] = [];
    const bySubject = new Map<string, { rows: TranscriptQuestion[]; limits: typeof questionRows }>();
    questions.forEach((question, index) => {
      const name = question.subjectName ?? "Questions";
      if (!bySubject.has(name)) {
        bySubject.set(name, { rows: [], limits: [] });
        subjectOrder.push(name);
      }
      const entry = bySubject.get(name)!;
      entry.rows.push(question);
      entry.limits.push(questionRows[index]);
    });
    const tally = (rows: TranscriptQuestion[]) => {
      const counts = { correct: 0, wrong: 0, partial: 0, skipped: 0 };
      const sums: AttemptMarks = { gained: 0, lost: 0, net: 0 };
      for (const row of rows) {
        counts[row.status] += 1;
        if (row.marksObtained > 0) sums.gained += row.marksObtained;
        if (row.marksObtained < 0) sums.lost -= row.marksObtained;
        sums.net += row.marksObtained;
      }
      return {
        counts,
        marks: { gained: round2(sums.gained) ?? 0, lost: round2(sums.lost) ?? 0, net: round2(sums.net) ?? 0 },
      };
    };
    const subjects: TranscriptSubject[] = subjectOrder.map((name) => {
      const entry = bySubject.get(name)!;
      const { counts, marks: subjectMarks } = tally(entry.rows);
      return { name, total: entry.rows.length, ...counts, ...subjectMarks, maxMarks: paperMaxMarks(entry.limits) };
    });

    const overall = tally(questions);
    // Answers to questions since removed from the paper still count in the stored marks.
    const attemptMarks = selected.marks ?? overall.marks;

    const output: OutputType = {
      student: { id: user.id, name: user.displayName?.trim() || "Student", avatarUrl: avatarOrNull(user.avatarUrl) },
      paper: {
        itemId: input.itemId,
        title: str(get(paper, "paper_title"), "Untitled paper").trim() || "Untitled paper",
        seriesTitle: str(get(paper, "series_title"), "Untitled").trim() || "Untitled",
        isLiveTest: get(paper, "live_test_id") !== null && get(paper, "live_test_id") !== undefined,
        maxMarks: paperMaxMarks(questionRows),
      },
      attempts,
      attempt: { ...selected, finished: selected.completedAt !== null, counts: overall.counts, marks: attemptMarks },
      subjects,
      questions,
    };
    return performanceJson(output);
  } catch (error) {
    return performanceErrorResponse("attempt", error);
  }
}