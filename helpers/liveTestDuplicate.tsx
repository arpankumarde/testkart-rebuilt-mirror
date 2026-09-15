import type { InsertObject, Selectable } from "kysely";
import type { DB, LiveTests } from "./schema";
import { parseStoredPrizeTiers } from "./liveTestPrizeTiers";
import { jsonbParam } from "./jsonbParam";

export interface DuplicateLiveTestSchedule {
  startTime?: Date | null;
  endTime: Date;
  registrationDeadline?: Date | null;
}

/**
 * Insert values for re-running an ended live test: the source's content, pricing
 * and prize setup on the new schedule, as an unpublished draft with no
 * enrollments. The prize tier list is copied with the legacy columns so the copy
 * pays exactly the pool it advertises.
 */
export const buildDuplicatedLiveTestValues = (
  source: Selectable<LiveTests>,
  mockTestId: number,
  schedule: DuplicateLiveTestSchedule
): InsertObject<DB, "liveTests"> => ({
  mockTestId,
  teacherId: source.teacherId,
  title: source.title,
  description: source.description,
  price: source.price,
  discountPrice: source.discountPrice,
  isFree: source.isFree,
  startTime: schedule.startTime || null,
  endTime: schedule.endTime,
  registrationDeadline: schedule.registrationDeadline || null,
  maxSeats: source.maxSeats,
  thumbnailUrl: source.thumbnailUrl,
  thumbnailFileId: source.thumbnailFileId,
  introVideoUrl: source.introVideoUrl,
  introVideoFileId: source.introVideoFileId,
  hasPrizes: source.hasPrizes,
  prizeTiers: source.prizeTiers == null ? null : jsonbParam(parseStoredPrizeTiers(source.prizeTiers)),
  totalPrizePool: source.totalPrizePool,
  firstPrize: source.firstPrize,
  secondPrize: source.secondPrize,
  thirdPrize: source.thirdPrize,
  prizeFundSource: source.prizeFundSource,
  prizeDistributionStatus: source.hasPrizes ? "pending" : "not_applicable",
  actualTotalDistributed: "0",
  enrolledCount: 0,
  viewCount: 0,
  isActive: false,
});