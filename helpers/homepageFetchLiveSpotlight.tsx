import { db } from "./db";
import { sanitizeUrl } from "./sanitizeUrl";
import { HomepageLiveTestSpotlight } from "../endpoints/homepage/data_GET.schema";

export async function homepageFetchLiveSpotlight(): Promise<HomepageLiveTestSpotlight[]> {
  const now = new Date();

  const tests = await db
    .selectFrom("liveTests")
    .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
    .innerJoin("users", "users.id", "liveTests.teacherId")
    .where("liveTests.isActive", "=", true)
    .where("liveTests.endTime", ">", now)
    .where("liveTests.startTime", "is not", null)
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
      "users.displayName as teacherName",
      "users.slug as teacherSlug",
      "users.avatarUrl as teacherAvatarUrl",
      "users.tagline as teacherTagline",
      "users.yearsOfExperience as teacherYearsOfExperience",
      "users.isVerified as teacherIsVerified",
    ])
    .orderBy("liveTests.startTime", "asc")
    .limit(5)
    .execute();

  return tests
    .filter((test): test is typeof test & { startTime: Date } => test.startTime !== null)
    .sort((a, b) => {
      const aIsActive = a.startTime.getTime() <= now.getTime();
      const bIsActive = b.startTime.getTime() <= now.getTime();
      
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      return a.startTime.getTime() - b.startTime.getTime();
    })
    .map((test) => ({
      id: test.id,
      title: test.title,
      examName: test.examName,
      price: Number(test.price),
      enrolledCount: test.enrolledCount,
      maxSeats: test.maxSeats,
      hasPrizes: test.hasPrizes,
      totalPrizePool: Number(test.totalPrizePool),
      startTime: test.startTime,
      endTime: test.endTime,
      teacherName: test.teacherName,
      teacherSlug: test.teacherSlug,
      teacherAvatarUrl: sanitizeUrl(test.teacherAvatarUrl),
      teacherTagline: test.teacherTagline,
      teacherYearsOfExperience: test.teacherYearsOfExperience,
      teacherIsVerified: test.teacherIsVerified,
    }));
}