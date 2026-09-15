/**
 * Live test fields that stop being editable once the test is published. This is
 * exactly what the edit form disables for a published test: exam, format and
 * timing, pricing and capacity on Basic info, plus the whole Schedule and Prizes
 * steps. The update endpoint rejects any of them for a published test.
 */
export const LIVE_TEST_PUBLISHED_LOCKED_FIELDS = [
  "examName",
  "durationMinutes",
  "calculatorEnabled",
  "subjectWiseTiming",
  "questionWiseTiming",
  "price",
  "discountPrice",
  "isFree",
  "maxSeats",
  "registrationDeadline",
  "startTime",
  "endTime",
  "hasPrizes",
  "prizeTiers",
] as const;

export type LiveTestLockedField = (typeof LIVE_TEST_PUBLISHED_LOCKED_FIELDS)[number];

export const isLiveTestFieldLocked = (field: string, isPublished: boolean): boolean =>
  isPublished && (LIVE_TEST_PUBLISHED_LOCKED_FIELDS as readonly string[]).includes(field);

export const LIVE_TEST_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  examName: "Exam",
  language: "Language",
  durationMinutes: "Duration",
  calculatorEnabled: "Calculator",
  subjectWiseTiming: "Subject-wise timing",
  questionWiseTiming: "Question-wise timing",
  price: "Price",
  discountPrice: "Discount price",
  isFree: "Free pricing",
  maxSeats: "Max seats",
  thumbnailUrl: "Thumbnail",
  thumbnailFileId: "Thumbnail",
  introVideoUrl: "Intro video",
  introVideoFileId: "Intro video",
  whatYouLearn: "What you'll master",
  requirements: "Requirements",
  registrationDeadline: "Registration deadline",
  startTime: "Start time",
  endTime: "End time",
  hasPrizes: "Prize money",
  prizeTiers: "Prize ranks",
};