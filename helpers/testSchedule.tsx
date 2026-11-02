/*
 * A test inside a series can be scheduled to open later. Until it opens it may
 * have no questions yet: students still see it listed, with its question count
 * and subject split hidden. Once it opens, a test with no questions drops off
 * the student lists again.
 */

export const isScheduledAhead = (date: Date | string | null | undefined, now: Date = new Date()): boolean =>
  !!date && new Date(date).getTime() > now.getTime();

/** Whether students see this test in a series: it has questions, or it opens later. */
export const isTestOfferedToStudents = (
  item: { totalQuestions: number; scheduledDate: Date | string | null | undefined },
  now: Date = new Date()
): boolean => item.totalQuestions > 0 || isScheduledAhead(item.scheduledDate, now);

/** Whether students can take this test right now: it has questions and is not scheduled for later. */
export const isTestAvailableNow = (
  item: { totalQuestions: number; scheduledDate: Date | string | null | undefined },
  now: Date = new Date()
): boolean => item.totalQuestions > 0 && !isScheduledAhead(item.scheduledDate, now);
