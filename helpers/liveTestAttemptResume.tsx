import { db } from "./db";
import {
  LiveTestPaper,
  attemptStartedInLiveWindow,
  getLiveTestPaperDurationSeconds,
  isEnrolledInLiveTest,
  liveAttemptSecondsLeft,
  liveTestWindowError,
} from "./liveTestAttemptWindow";
import { AttemptProgressState, emptyProgressState, parseStoredProgressState } from "./testAttemptProgressState";

export type ResumableLiveAttempt = {
  attemptId: number;
  startedAt: Date;
  totalQuestions: number;
  savedAt: Date;
  answeredCount: number;
  elapsedSeconds: number;
  secondsLeft: number;
  state: AttemptProgressState;
};

/**
 * The student's open attempt on a live test paper, while submissions are still
 * taken. A live attempt can only be continued, never restarted, and its clock
 * keeps running from startedAt, so an attempt with no saved progress yet (a
 * refresh before the first save, or one opened in the app) still comes back.
 */
export async function findResumableLiveAttempt(
  studentId: number,
  testItemId: number,
  paper: LiveTestPaper,
  attemptId?: number
): Promise<ResumableLiveAttempt | null> {
  if (liveTestWindowError(paper, "continue")) return null;
  if (!(await isEnrolledInLiveTest(studentId, paper.liveTestId))) return null;

  let query = db
    .selectFrom("testAttempts")
    .leftJoin("testAttemptProgress", "testAttemptProgress.attemptId", "testAttempts.id")
    .select([
      "testAttempts.id",
      "testAttempts.startedAt",
      "testAttempts.totalQuestions",
      "testAttemptProgress.state",
      "testAttemptProgress.answeredCount",
      "testAttemptProgress.updatedAt",
    ])
    .where("testAttempts.studentId", "=", studentId)
    .where("testAttempts.testId", "=", testItemId)
    .where("testAttempts.completedAt", "is", null);
  if (attemptId !== undefined) query = query.where("testAttempts.id", "=", attemptId);

  const row = await query.orderBy("testAttempts.startedAt", "desc").limit(1).executeTakeFirst();
  if (!row || !row.startedAt || !attemptStartedInLiveWindow(row.startedAt, paper)) return null;

  const startedAt = new Date(row.startedAt);
  const now = new Date();
  const durationSeconds = await getLiveTestPaperDurationSeconds(testItemId);
  const secondsLeft = liveAttemptSecondsLeft(startedAt, durationSeconds, paper, now);
  const state = (row.state != null ? parseStoredProgressState(row.state) : null) ?? emptyProgressState(secondsLeft);

  return {
    attemptId: row.id,
    startedAt,
    totalQuestions: row.totalQuestions,
    savedAt: row.updatedAt ? new Date(row.updatedAt) : startedAt,
    answeredCount: state.answers.length,
    elapsedSeconds: Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000)),
    secondsLeft,
    state,
  };
}