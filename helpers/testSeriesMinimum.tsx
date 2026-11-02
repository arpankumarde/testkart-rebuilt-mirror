/*
 * Before a test series is published, sent for review or made public it needs
 * at least this many questions across its tests (trashed tests do not count),
 * and at least one test students can take now: one with questions that is not
 * scheduled for later (helpers/testSchedule). Tests scheduled for later may
 * still be empty. Shared by the teacher review page and the server checks
 * (helpers/testSeriesMinimumServer).
 */
export const MIN_SERIES_QUESTIONS = 10;

export const NO_TEST_AVAILABLE_MESSAGE =
  "At least one test must be open now, with questions, before this test series can be submitted for review or published. Tests scheduled for later can stay empty until they open.";

export const seriesQuestionsShortMessage = (count: number) =>
  `A test series needs at least ${MIN_SERIES_QUESTIONS} questions before it can be submitted for review or published. This one has ${count}.`;
