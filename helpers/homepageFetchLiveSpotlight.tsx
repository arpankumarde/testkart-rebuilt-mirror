import { db } from "./db";
import { sanitizeUrl } from "./sanitizeUrl";
import { HomepageLiveTestSpotlight } from "../endpoints/homepage/data_GET.schema";

const MAX_CARDS = 8;
const MIN_UPCOMING_SLOTS = 3;

/**
 * Running and upcoming live tests for the homepage, running ones first. A test
 * with no fixed start time is open (live) until it ends, matching
 * helpers/liveTestStatus. Slots are shared so neither group crowds the other
 * out: up to MIN_UPCOMING_SLOTS are held for upcoming tests and any slots
 * either group leaves unused go to the other.
 */
export async function homepageFetchLiveSpotlight(): Promise<HomepageLiveTestSpotlight[]> {
  const now = new Date();

  const tests = await db
    .selectFrom("liveTests")
    .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
    .innerJoin("users", "users.id", "liveTests.teacherId")
    .where("liveTests.isActive", "=", true)
    .where("liveTests.visibility", "=", "public")
    .where("liveTests.endTime", ">", now)
    .select([
      "liveTests.id",
      "liveTests.title",
      "liveTests.price",
      "liveTests.enrolledCount",
      "liveTests.maxSeats",
      "liveTests.hasPrizes",
      "liveTests.totalPrizePool",
      "liveTests.startTime",
      "liveTests.endTime",
      "mockTests.examName",
      "mockTests.slug",
      "users.displayName as teacherName",
      "users.slug as teacherSlug",
      "users.avatarUrl as teacherAvatarUrl",
      "users.tagline as teacherTagline",
      "users.yearsOfExperience as teacherYearsOfExperience",
      "users.isVerified as teacherIsVerified",
    ])
    .execute();

  const isRunning = (test: (typeof tests)[number]) =>
    test.startTime === null || test.startTime.getTime() <= now.getTime();

  const live = tests
    .filter(isRunning)
    .sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
  const upcoming = tests
    .filter((test) => !isRunning(test))
    .sort((a, b) => a.startTime!.getTime() - b.startTime!.getTime());

  const upcomingCount = Math.min(upcoming.length, Math.max(MIN_UPCOMING_SLOTS, MAX_CARDS - live.length));
  const liveCount = Math.min(live.length, MAX_CARDS - upcomingCount);

  return [
    ...live.slice(0, liveCount).map((test) => ({ test, isLive: true })),
    ...upcoming.slice(0, upcomingCount).map((test) => ({ test, isLive: false })),
  ].map(({ test, isLive }) => ({
    id: test.id,
    slug: test.slug,
    title: test.title,
    examName: test.examName,
    price: Number(test.price),
    enrolledCount: test.enrolledCount,
    maxSeats: test.maxSeats,
    hasPrizes: test.hasPrizes,
    totalPrizePool: Number(test.totalPrizePool),
    startTime: test.startTime,
    endTime: test.endTime,
    isLive,
    teacherName: test.teacherName,
    teacherSlug: test.teacherSlug,
    teacherAvatarUrl: sanitizeUrl(test.teacherAvatarUrl),
    teacherTagline: test.teacherTagline,
    teacherYearsOfExperience: test.teacherYearsOfExperience,
    teacherIsVerified: test.teacherIsVerified,
  }));
}