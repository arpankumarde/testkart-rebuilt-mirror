import { db } from "./db";

/**
 * Timing rules for live test papers. A paper only opens while its live test
 * runs, and answers stay hidden until submissions close, so an early submission
 * can't hand the answer key to students still sitting the paper.
 */

/** A submission in flight when the live test ends is still accepted for this long. */
export const LIVE_TEST_SUBMIT_GRACE_MS = 5 * 60 * 1000;

export type LiveTestPaper = {
  liveTestId: number;
  startTime: Date | null;
  endTime: Date;
};

export async function getLiveTestForTestItem(testItemId: number): Promise<LiveTestPaper | null> {
  const row = await db
    .selectFrom("mockTestItems")
    .innerJoin("liveTests", "liveTests.mockTestId", "mockTestItems.packageId")
    .select(["liveTests.id as liveTestId", "liveTests.startTime", "liveTests.endTime"])
    .where("mockTestItems.id", "=", testItemId)
    .executeTakeFirst();

  if (!row) return null;
  return {
    liveTestId: row.liveTestId,
    startTime: row.startTime ? new Date(row.startTime) : null,
    endTime: new Date(row.endTime),
  };
}

export async function isEnrolledInLiveTest(studentId: number, liveTestId: number): Promise<boolean> {
  const enrollment = await db
    .selectFrom("liveTestEnrollments")
    .select("id")
    .where("studentId", "=", studentId)
    .where("liveTestId", "=", liveTestId)
    .executeTakeFirst();
  return !!enrollment;
}

export function liveTestSubmissionsCloseAt(liveTest: { endTime: Date }): Date {
  return new Date(new Date(liveTest.endTime).getTime() + LIVE_TEST_SUBMIT_GRACE_MS);
}

/** True once no more submissions can arrive, so answers and final ranks can be shown. */
export function liveTestResultsReleased(liveTest: { endTime: Date }, now = new Date()): boolean {
  return now.getTime() > liveTestSubmissionsCloseAt(liveTest).getTime();
}

/**
 * Why the paper can't be used right now, or null when it can. Starting an
 * attempt needs the live window itself; loading questions and submitting also
 * allow the grace period after the end.
 */
export function liveTestWindowError(
  paper: LiveTestPaper,
  action: "start" | "continue",
  now = new Date()
): string | null {
  if (paper.startTime && now.getTime() < paper.startTime.getTime()) {
    return "This live test has not started yet.";
  }
  const closesAt = action === "start" ? paper.endTime : liveTestSubmissionsCloseAt(paper);
  if (now.getTime() > closesAt.getTime()) {
    return "This live test has ended.";
  }
  return null;
}

export function attemptStartedInLiveWindow(startedAt: Date | null, paper: LiveTestPaper): boolean {
  if (!startedAt) return false;
  const started = new Date(startedAt).getTime();
  if (paper.startTime && started < paper.startTime.getTime()) return false;
  return started <= paper.endTime.getTime();
}
