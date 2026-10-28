import { db } from "./db";
import {
  LIVE_TEST_SUBMIT_GRACE_MS,
  LiveTestPaper,
  getLiveTestForTestItem,
  getLiveTestPaperDurationSeconds,
  liveTestResultsReleased,
} from "./liveTestAttemptWindow";
import { parseStoredProgressState } from "./testAttemptProgressState";
import {
  ScoringQuestion,
  answersFromProgressState,
  closeScoredAttempt,
  loadScoringQuestions,
  scoreAttempt,
  trimToAttemptLimits,
} from "./testAttemptScoring";

const MAX_ATTEMPTS_PER_RUN = 200;

export type AutoCloseSummary = { closed: number; failed: number };

/**
 * When an auto-closed attempt counts as finished. With saved progress it is the
 * last autosave; without any it is when the attempt's clock ran out (the paper
 * duration from startedAt, stopped at the live test's end). Either way it stays
 * between startedAt and that run-out, so it falls inside the ranking window.
 */
export function autoCloseCompletedAt(
  startedAt: Date | null,
  lastSavedAt: Date | null,
  durationSeconds: number,
  paper: LiveTestPaper
): Date {
  const endMs = paper.endTime.getTime();
  if (!startedAt) return new Date(endMs);
  const startMs = new Date(startedAt).getTime();
  const runOutMs = Math.max(startMs, Math.min(startMs + durationSeconds * 1000, endMs));
  if (!lastSavedAt) return new Date(runOutMs);
  return new Date(Math.min(runOutMs, Math.max(startMs, new Date(lastSavedAt).getTime())));
}

/**
 * Closes live test attempts that were never submitted once the live test's
 * submissions have closed, scoring each from the web player's saved answers
 * (or as all unanswered when nothing was saved), so they reach the leaderboard
 * and the prize payout. Sends no "test completed" email. Pass a live test id
 * to close only that test's attempts.
 */
export async function closeOpenLiveTestAttempts(liveTestId?: number): Promise<AutoCloseSummary> {
  const closedBefore = new Date(Date.now() - LIVE_TEST_SUBMIT_GRACE_MS);

  const open = await db
    .selectFrom("testAttempts")
    .innerJoin("mockTestItems", "mockTestItems.id", "testAttempts.testId")
    .innerJoin("liveTests", "liveTests.mockTestId", "mockTestItems.packageId")
    .leftJoin("testAttemptProgress", "testAttemptProgress.attemptId", "testAttempts.id")
    .select([
      "testAttempts.id",
      "testAttempts.testId",
      "testAttempts.startedAt",
      "testAttemptProgress.state",
      "testAttemptProgress.updatedAt as lastSavedAt",
    ])
    .where("testAttempts.completedAt", "is", null)
    .where("liveTests.endTime", "<", closedBefore)
    .$if(liveTestId !== undefined, (qb) => qb.where("liveTests.id", "=", liveTestId!))
    .orderBy("testAttempts.id", "asc")
    .limit(MAX_ATTEMPTS_PER_RUN)
    .execute();

  const papers = new Map<number, { paper: LiveTestPaper | null; durationSeconds: number; questions: ScoringQuestion[] }>();
  const seen = new Set<number>();
  const summary: AutoCloseSummary = { closed: 0, failed: 0 };

  for (const attempt of open) {
    if (seen.has(attempt.id)) continue;
    seen.add(attempt.id);

    try {
      let paperInfo = papers.get(attempt.testId);
      if (!paperInfo) {
        const paper = await getLiveTestForTestItem(attempt.testId);
        paperInfo = paper
          ? {
              paper,
              durationSeconds: await getLiveTestPaperDurationSeconds(attempt.testId),
              questions: await loadScoringQuestions(attempt.testId),
            }
          : { paper: null, durationSeconds: 0, questions: [] };
        papers.set(attempt.testId, paperInfo);
      }

      const { paper, durationSeconds, questions } = paperInfo;
      // Same live test the submit path checks against; skip if it is still taking submissions.
      if (!paper || !liveTestResultsReleased(paper)) continue;

      const state = attempt.state == null ? null : parseStoredProgressState(attempt.state);
      const answers = state ? trimToAttemptLimits(questions, answersFromProgressState(state)) : [];
      const scored = scoreAttempt(attempt.id, questions, answers);
      const completedAt = autoCloseCompletedAt(
        attempt.startedAt ? new Date(attempt.startedAt) : null,
        state && attempt.lastSavedAt ? new Date(attempt.lastSavedAt) : null,
        durationSeconds,
        paper
      );

      if (await closeScoredAttempt(attempt.id, completedAt, scored)) {
        summary.closed++;
        console.log(
          `[liveTestAttemptAutoClose] Closed attempt ${attempt.id}: ${answers.length} saved answer(s), score ${scored.percentageScore.toFixed(2)}`
        );
      }
    } catch (error) {
      summary.failed++;
      console.error(`[liveTestAttemptAutoClose] Attempt ${attempt.id} failed:`, error);
    }
  }

  return summary;
}
