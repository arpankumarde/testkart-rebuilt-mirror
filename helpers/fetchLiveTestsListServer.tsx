import { db } from "./db";
import { sql } from "kysely";
import type { OutputType, InputType, LiveTestStatus } from "../endpoints/live-tests/list_GET.schema";

function getLiveTestStatus(
  startTime: Date | null,
  endTime: Date,
  registrationDeadline: Date | null,
  maxSeats: number,
  enrolledCount: number
): LiveTestStatus {
  const now = new Date();

  if (now > endTime) return "ended";

  if (startTime === null) {
    if (now <= endTime) return "live";
  } else {
    if (now >= startTime && now <= endTime) return "live";
  }

  if (enrolledCount >= maxSeats) return "seats_full";

  if (registrationDeadline !== null && now > registrationDeadline) {
    return "registration_closed";
  }

  return "upcoming";
}

/**
 * Direct-DB counterpart to endpoints/live-tests/list_GET.ts, for use ONLY
 * from page prefetch (pages/mock-test.live.prefetch.ts) — see
 * helpers/fetchBlogPostDetailServer.tsx for why the network endpoint can't
 * be called from within the SSR pass. Keep in sync with
 * endpoints/live-tests/list_GET.ts.
 *
 * SSR is always anonymous, so isEnrolled/hasAttempted are hardcoded false
 * (matching the fetchTestDetailsServer.tsx convention) — the client
 * re-fetches with real session data after hydration.
 */
export async function fetchLiveTestsListServer(
  filters: Partial<InputType> = {}
): Promise<OutputType> {
  const status = filters.status;
  const examName = filters.examName;
  const searchQuery = filters.searchQuery;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const offset = (page - 1) * limit;

  let query = db
    .selectFrom("liveTests")
    .innerJoin("users", "users.id", "liveTests.teacherId")
    .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
    .leftJoin("exams", "exams.examName", "mockTests.examName")
    .select([
      "liveTests.id",
      "liveTests.title",
      "liveTests.description",
      "liveTests.price",
      "liveTests.startTime",
      "liveTests.endTime",
      "liveTests.registrationDeadline",
      "liveTests.maxSeats",
      "liveTests.enrolledCount",
      "liveTests.thumbnailUrl",
      "liveTests.introVideoUrl",
      "liveTests.hasPrizes",
      "liveTests.totalPrizePool",
      "liveTests.firstPrize",
      "liveTests.secondPrize",
      "liveTests.thirdPrize",
      "liveTests.mockTestId",
      "liveTests.viewCount",
      "mockTests.examName",
      "users.displayName as teacherName",
      "users.isVerified as teacherIsVerified",
      (eb) =>
        eb
          .selectFrom("mockTestItems")
          .select(sql<number>`COALESCE(SUM(duration_minutes), 0)`.as("total"))
          .whereRef("mockTestItems.packageId", "=", "mockTests.id")
          .as("durationMinutes"),
      "mockTests.language",
      "exams.examSlug",
      (eb) =>
        eb
          .selectFrom("testQuestions")
          .select((eb2) => eb2.fn.countAll<number>().as("count"))
          .whereRef("testQuestions.testId", "in", (eb2) =>
            eb2
              .selectFrom("mockTestItems")
              .select("mockTestItems.id")
              .whereRef("mockTestItems.packageId", "=", "mockTests.id")
          )
          .as("actualQuestionCount"),
      (eb) => sql<string | null>`(
        SELECT string_agg(tis.subject_name, ', ' ORDER BY tis.order_index)
        FROM test_item_subjects tis
        WHERE tis.test_item_id = (
          SELECT mti.id 
          FROM mock_test_items mti 
          WHERE mti.package_id = ${eb.ref("mockTests.id")}
          ORDER BY mti.order_index 
          LIMIT 1
        )
      )`.as("subjects"),
    ]);

  if (examName) {
    query = query.where("mockTests.examName", "ilike", `%${examName}%`);
  }

  if (searchQuery) {
    const searchPattern = `%${searchQuery}%`;
    query = query.where((eb) =>
      eb.or([
        eb("liveTests.title", "ilike", searchPattern),
        eb("liveTests.description", "ilike", searchPattern),
        eb("users.displayName", "ilike", searchPattern),
      ])
    );
  }

  const allTests = await query
    .where("liveTests.isActive", "=", true)
    .orderBy("liveTests.startTime", "asc")
    .execute();

  let testsWithStatus = allTests.map((test) => ({
    ...test,
    status: getLiveTestStatus(
      test.startTime,
      test.endTime,
      test.registrationDeadline,
      test.maxSeats,
      test.enrolledCount
    ),
  }));

  if (status && status !== "all") {
    testsWithStatus = testsWithStatus.filter((test) => test.status === status);
    if (status === "ended") {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      testsWithStatus = testsWithStatus.filter(
        (test) => test.enrolledCount >= 1 && new Date(test.endTime) >= sixtyDaysAgo
      );
    }
  } else {
    testsWithStatus = testsWithStatus.filter((test) => test.status !== "ended");
  }

  const statusOrder: Record<string, number> = {
    live: 0,
    upcoming: 1,
    seats_full: 2,
    registration_closed: 3,
    ended: 4,
  };
  testsWithStatus.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

  const total = testsWithStatus.length;
  const paginatedTests = testsWithStatus.slice(offset, offset + limit);

  const testsWithEnrollment = paginatedTests.map((test) => {
    const examSlug = test.examSlug || "general-exam";

    return {
      ...test,
      price: parseFloat(test.price),
      totalPrizePool: parseFloat(test.totalPrizePool),
      firstPrize: parseFloat(test.firstPrize),
      secondPrize: parseFloat(test.secondPrize),
      thirdPrize: parseFloat(test.thirdPrize),
      actualQuestionCount: test.actualQuestionCount ?? 0,
      durationMinutes: Number(test.durationMinutes) || 0,
      subjects: test.subjects,
      viewCount: test.viewCount,
      isEnrolled: false,
      hasAttempted: false,
      examSlug,
      teacherIsVerified: !!test.teacherIsVerified,
      examName: test.examName ?? null,
    };
  });

  return {
    tests: testsWithEnrollment,
    total,
    page,
    limit,
  };
}
