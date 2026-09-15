import type { Kysely, Selectable, UpdateObject } from "kysely";
import type { DB, LiveTests } from "./schema";
import type { InputType as LiveTestUpdateInput } from "../endpoints/teacher/live-tests/update_POST.schema";
import {
  getTotalPrizePool,
  resolveLiveTestPrizeTiers,
  sortPrizeTiers,
  tiersToLegacyPrizes,
  validatePrizeTiers,
} from "./liveTestPrizeTiers";
import { LIVE_TEST_FIELD_LABELS, LIVE_TEST_PUBLISHED_LOCKED_FIELDS } from "./liveTestLocks";
import { jsonbParam } from "./jsonbParam";
import { sanitizeHtml } from "./sanitizeHtml";

export class LiveTestUpdateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "LiveTestUpdateError";
  }
}

export interface LiveTestUpdateDeps {
  resolveExam: (examName: string | null) => Promise<{ examId: number | null; examName: string | null }>;
  countEnrollments: (liveTestId: number) => Promise<number>;
}

const toAmount = (value: string | number | null | undefined): number => {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
};

const fail = (message: string, status = 400): never => {
  throw new LiveTestUpdateError(message, status);
};

/**
 * Applies a teacher's partial live test update. Only fields present in the input
 * are written, and every write is scoped to the live test and the mock test
 * stored on it, never to ids from the request. Rules that depend on stored
 * values run against the merged result: the published lock, schedule order,
 * pricing, timing and prize tiers.
 */
export async function applyLiveTestUpdate(
  executor: Kysely<DB>,
  teacherId: number,
  input: LiveTestUpdateInput,
  deps: LiveTestUpdateDeps
): Promise<Selectable<LiveTests>> {
  const liveTest = await executor
    .selectFrom("liveTests")
    .selectAll()
    .where("id", "=", input.id)
    .executeTakeFirst();

  if (!liveTest) return fail("Live test not found.", 404);
  if (liveTest.teacherId !== teacherId) return fail("You do not own this live test.", 403);

  if (liveTest.isActive) {
    const locked = LIVE_TEST_PUBLISHED_LOCKED_FIELDS.filter((field) => input[field] !== undefined);
    if (locked.length > 0) {
      const labels = [...new Set(locked.map((field) => LIVE_TEST_FIELD_LABELS[field]))];
      return fail(`This live test is published, so these can no longer change: ${labels.join(", ")}.`);
    }
  }

  const scheduleTouched =
    input.startTime !== undefined || input.endTime !== undefined || input.registrationDeadline !== undefined;
  if (scheduleTouched) {
    const start = input.startTime !== undefined ? input.startTime : liveTest.startTime;
    const end = input.endTime ?? liveTest.endTime;
    const deadline = input.registrationDeadline !== undefined ? input.registrationDeadline : liveTest.registrationDeadline;
    if (start && new Date(start).getTime() >= new Date(end).getTime()) {
      fail("Start time must be before the end time.");
    }
    if (deadline && start && new Date(deadline).getTime() >= new Date(start).getTime()) {
      fail("Registration deadline must be before the start time.");
    }
  }

  if (input.maxSeats !== undefined) {
    const enrolled = await deps.countEnrollments(liveTest.id);
    if (input.maxSeats < enrolled) {
      fail(`Cannot reduce max seats below the current number of enrolled students (${enrolled}).`);
    }
  }

  const price = input.price ?? toAmount(liveTest.price);
  if (input.price !== undefined || input.discountPrice !== undefined || input.isFree !== undefined) {
    const isFree = input.isFree ?? liveTest.isFree;
    const discountPrice =
      input.discountPrice !== undefined
        ? input.discountPrice
        : liveTest.discountPrice === null
          ? null
          : toAmount(liveTest.discountPrice);
    if (isFree && (price !== 0 || (discountPrice ?? 0) !== 0)) {
      fail("If the test is free, both price and discount price must be 0.");
    }
    if (discountPrice !== null && discountPrice > price) {
      fail("Discount price must be less than or equal to price.");
    }
  }

  // Subject-wise and question-wise timing are mutually exclusive, and either one
  // replaces the overall duration with 0, as on the form.
  let subjectWiseTiming = input.subjectWiseTiming;
  let questionWiseTiming = input.questionWiseTiming;
  if (subjectWiseTiming === true && questionWiseTiming === undefined) questionWiseTiming = false;
  if (questionWiseTiming === true && subjectWiseTiming === undefined) subjectWiseTiming = false;
  let durationMinutes = input.durationMinutes;
  const timingTouched =
    durationMinutes !== undefined || subjectWiseTiming !== undefined || questionWiseTiming !== undefined;
  if (timingTouched) {
    const item = await executor
      .selectFrom("mockTestItems")
      .select(["durationMinutes", "subjectWiseTiming", "questionWiseTiming"])
      .where("packageId", "=", liveTest.mockTestId)
      .orderBy("orderIndex", "asc")
      .executeTakeFirst();
    const timedPerSection =
      (subjectWiseTiming ?? item?.subjectWiseTiming ?? false) ||
      (questionWiseTiming ?? item?.questionWiseTiming ?? false);
    if (timedPerSection) {
      durationMinutes = 0;
    } else if ((durationMinutes ?? item?.durationMinutes ?? 0) < 1) {
      fail("Duration must be at least 1 minute.");
    }
  }

  const liveTestSet: UpdateObject<DB, "liveTests"> = {};
  if (input.title !== undefined) liveTestSet.title = input.title;
  const description =
    input.description === undefined ? undefined : input.description ? sanitizeHtml(input.description) : input.description;
  if (description !== undefined) liveTestSet.description = description;
  if (input.price !== undefined) liveTestSet.price = input.price.toString();
  if (input.discountPrice !== undefined) {
    liveTestSet.discountPrice = input.discountPrice === null ? null : input.discountPrice.toString();
  }
  if (input.isFree !== undefined) liveTestSet.isFree = input.isFree;
  if (input.startTime !== undefined) liveTestSet.startTime = input.startTime;
  if (input.endTime !== undefined) liveTestSet.endTime = input.endTime;
  if (input.registrationDeadline !== undefined) liveTestSet.registrationDeadline = input.registrationDeadline;
  if (input.maxSeats !== undefined) liveTestSet.maxSeats = input.maxSeats;
  if (input.thumbnailUrl !== undefined) liveTestSet.thumbnailUrl = input.thumbnailUrl;
  if (input.thumbnailFileId !== undefined) liveTestSet.thumbnailFileId = input.thumbnailFileId;
  else if (input.thumbnailUrl === null) liveTestSet.thumbnailFileId = null;
  if (input.introVideoUrl !== undefined) liveTestSet.introVideoUrl = input.introVideoUrl;
  if (input.introVideoFileId !== undefined) liveTestSet.introVideoFileId = input.introVideoFileId;
  else if (input.introVideoUrl === null) liveTestSet.introVideoFileId = null;

  if (input.hasPrizes !== undefined || input.prizeTiers !== undefined) {
    const hasPrizes = input.hasPrizes ?? liveTest.hasPrizes;
    // Prizes switched off clear the tiers and pool rather than keeping a pool
    // nobody will be paid.
    const tiers = hasPrizes
      ? sortPrizeTiers(
          input.prizeTiers ??
            resolveLiveTestPrizeTiers(liveTest.prizeTiers, liveTest.firstPrize, liveTest.secondPrize, liveTest.thirdPrize)
        )
      : [];
    const tierError = validatePrizeTiers(tiers);
    if (tierError) fail(tierError);
    const legacy = tiersToLegacyPrizes(tiers);
    liveTestSet.hasPrizes = hasPrizes;
    liveTestSet.prizeTiers = jsonbParam(tiers);
    liveTestSet.totalPrizePool = getTotalPrizePool(tiers).toString();
    liveTestSet.firstPrize = legacy.firstPrize.toString();
    liveTestSet.secondPrize = legacy.secondPrize.toString();
    liveTestSet.thirdPrize = legacy.thirdPrize.toString();
  }

  if (input.hasPrizes === true) {
    liveTestSet.prizeFundSource = price === 0 ? "teacher_wallet" : "enrollment";
    liveTestSet.prizeDistributionStatus = "pending";
  } else if (input.hasPrizes === false) {
    liveTestSet.prizeFundSource = null;
    liveTestSet.prizeDistributionStatus = "not_applicable";
  } else if (input.price !== undefined && liveTest.hasPrizes) {
    liveTestSet.prizeFundSource = input.price === 0 ? "teacher_wallet" : "enrollment";
  }

  const itemSet: UpdateObject<DB, "mockTestItems"> = {};
  if (durationMinutes !== undefined) itemSet.durationMinutes = durationMinutes;
  if (input.calculatorEnabled !== undefined) itemSet.calculatorEnabled = input.calculatorEnabled;
  if (subjectWiseTiming !== undefined) itemSet.subjectWiseTiming = subjectWiseTiming;
  if (questionWiseTiming !== undefined) itemSet.questionWiseTiming = questionWiseTiming;

  // The mock test backing a live test repeats its product fields; keep the ones
  // that were sent in step.
  const mockTestSet: UpdateObject<DB, "mockTests"> = {};
  if (input.title !== undefined) mockTestSet.title = input.title;
  if (description !== undefined) mockTestSet.description = description;
  if (input.thumbnailUrl !== undefined) mockTestSet.thumbnailUrl = input.thumbnailUrl;
  if (input.introVideoUrl !== undefined) mockTestSet.introVideoUrl = input.introVideoUrl;
  if (input.introVideoFileId !== undefined) mockTestSet.introVideoFileId = input.introVideoFileId;
  else if (input.introVideoUrl === null) mockTestSet.introVideoFileId = null;
  if (input.isFree !== undefined) mockTestSet.isFree = input.isFree;
  if (input.language !== undefined) mockTestSet.language = input.language;
  if (input.whatYouLearn !== undefined) {
    mockTestSet.whatYouLearn = input.whatYouLearn ? JSON.stringify(input.whatYouLearn) : null;
  }
  if (input.requirements !== undefined) {
    mockTestSet.requirements = input.requirements ? JSON.stringify(input.requirements) : null;
  }
  if (input.examName !== undefined) {
    const exam = await deps.resolveExam(input.examName);
    mockTestSet.examId = exam.examId;
    mockTestSet.examName = exam.examName;
  }

  return executor.transaction().execute(async (trx) => {
    const updated =
      Object.keys(liveTestSet).length > 0
        ? await trx
            .updateTable("liveTests")
            .set(liveTestSet)
            .where("id", "=", liveTest.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        : liveTest;

    if (Object.keys(itemSet).length > 0) {
      await trx.updateTable("mockTestItems").set(itemSet).where("packageId", "=", liveTest.mockTestId).execute();
    }
    if (Object.keys(mockTestSet).length > 0) {
      await trx.updateTable("mockTests").set(mockTestSet).where("id", "=", liveTest.mockTestId).execute();
    }
    return updated;
  });
}