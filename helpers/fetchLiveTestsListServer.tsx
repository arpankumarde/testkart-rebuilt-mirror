import { db } from "./db";
import { sql } from "kysely";
import { contentInExamSlug, loadContentExams } from "./contentExams";
import { liveTestDiscountPrice } from "./liveTestPricing";
import type { OutputType, InputType, LiveTestStatus } from "../endpoints/live-tests/list_GET.schema";

type DisplayExam = { examName: string; examSlug: string | null };

// Keep in sync with otherExamsMatchingName in endpoints/live-tests/list_GET.ts.
async function otherExamsMatchingName(mockTestIds: number[], examName: string) {
  const needle = examName.toLowerCase();
  const lists = await loadContentExams(db, "mock_test", mockTestIds);
  const picks = new Map<number, { examId: number | null; examName: string }>();
  for (const [mockTestId, exams] of lists) {
    const hit = exams.find((exam) => exam.examName.toLowerCase().includes(needle));
    if (hit) picks.set(mockTestId, hit);
  }
  const examIds = [...picks.values()].flatMap((exam) => (exam.examId === null ? [] : [exam.examId]));
  const slugRows =
    examIds.length > 0
      ? await db.selectFrom("exams").select(["id", "examSlug"]).where("id", "in", examIds).execute()
      : [];
  const slugById = new Map(slugRows.map((row) => [row.id, row.examSlug]));
  const result = new Map<number, DisplayExam>();
  for (const [mockTestId, exam] of picks) {
    result.set(mockTestId, {
      examName: exam.examName,
      examSlug: exam.examId === null ? null : slugById.get(exam.examId) ?? null,
    });
  }
  return result;
}

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
  const examSlugFilter = filters.examSlug || filters.exam;
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
      "liveTests.discountPrice",
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

  let filterExam: DisplayExam | null = null;
  if (examSlugFilter) {
    query = query.where(contentInExamSlug("mock_test", "mockTests.id", "mockTests.examId", examSlugFilter));
    filterExam =
      (await db
        .selectFrom("exams")
        .select(["examName", "examSlug"])
        .where("examSlug", "=", examSlugFilter)
        .executeTakeFirst()) ?? null;
  }

  if (examName) {
    const examPattern = `%${examName}%`;
    query = query.where((eb) =>
      eb.or([
        eb("mockTests.examName", "ilike", examPattern),
        sql<boolean>`EXISTS (
          SELECT 1 FROM mock_test_exams mte
          WHERE mte.mock_test_id = ${eb.ref("mockTests.id")} AND mte.exam_name ILIKE ${examPattern}
        )`,
      ])
    );
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

  const nameMatchedExams =
    !filterExam && examName
      ? await otherExamsMatchingName(
          paginatedTests
            .filter((test) => !test.examName?.toLowerCase().includes(examName.toLowerCase()))
            .map((test) => test.mockTestId),
          examName
        )
      : new Map<number, DisplayExam>();

  const testsWithEnrollment = paginatedTests.map((test) => {
    const displayExam = filterExam ?? nameMatchedExams.get(test.mockTestId);
    const examSlug = (displayExam ? displayExam.examSlug : test.examSlug) || "general-exam";

    return {
      ...test,
      price: parseFloat(test.price),
      discountPrice: liveTestDiscountPrice(test.price, test.discountPrice),
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
      examName: displayExam?.examName ?? test.examName ?? null,
    };
  });

  return {
    tests: testsWithEnrollment,
    total,
    page,
    limit,
  };
}
