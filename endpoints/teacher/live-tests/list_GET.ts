import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import {
  OutputType,
  LiveTestStatus,
  LiveTestListFilter,
  LiveTestListFilterValues,
} from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getLiveTestStatus(
  startTime: Date,
  endTime: Date,
  registrationDeadline: Date,
  maxSeats: number,
  enrolledCount: number,
  isActive: boolean
): LiveTestStatus {
  if (!isActive) return "draft";
  const now = new Date();
  if (now > endTime) return "ended";
  if (now >= startTime && now <= endTime) return "live";
  if (enrolledCount >= maxSeats) return "seats_full";
  if (now > registrationDeadline) return "registration_closed";
  return "upcoming";
}

function matchesListFilter(
  test: {
    isActive: boolean;
    hasPrizes: boolean;
    prizeDistributionStatus: string;
    startTime: Date | null;
    endTime: Date;
  },
  filter: LiveTestListFilter,
  now: number
): boolean {
  const start = test.startTime ? new Date(test.startTime).getTime() : null;
  const end = new Date(test.endTime).getTime();
  switch (filter) {
    case "prizes-pending":
      return test.hasPrizes && test.prizeDistributionStatus === "pending" && end < now;
    case "starting-soon":
      return test.isActive && start !== null && start > now && start <= now + WEEK_MS;
    case "active":
      return test.isActive && end > now;
  }
}

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const filterParam = url.searchParams.get("filter");
    const filter = LiveTestListFilterValues.find((value) => value === filterParam);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const offset = (page - 1) * limit;

    const allTests = await db
      .selectFrom("liveTests")
      .where("teacherId", "=", effectiveTeacherId)
      .selectAll()
      .orderBy("startTime", "desc")
      .execute();

    // Fetch actual revenue per live test in a single query:
    // liveTestEnrollments → orders (completed) → orderItems, sum (priceAtPurchase - discountAmount)
    const liveTestIds = allTests.map((t) => t.id);

    const revenueRows =
      liveTestIds.length > 0
        ? await db
            .selectFrom("liveTestEnrollments as lte")
            .innerJoin("orders as o", (join) =>
              join
                .onRef("o.id", "=", "lte.paymentOrderId")
                .on("o.status", "=", "completed")
            )
            .innerJoin("orderItems as oi", "oi.orderId", "o.id")
            .where("lte.liveTestId", "in", liveTestIds)
            .select([
              "lte.liveTestId",
              sql<string>`SUM(CAST(oi.price_at_purchase AS numeric) - CAST(oi.discount_amount AS numeric))`.as(
                "totalRevenue"
              ),
            ])
            .groupBy("lte.liveTestId")
            .execute()
        : [];

    const revenueByLiveTestId = new Map<number, number>();
    for (const row of revenueRows) {
      revenueByLiveTestId.set(
        row.liveTestId,
        parseFloat(row.totalRevenue ?? "0")
      );
    }

    // Fetch total duration per live test in a single batched query:
    // sum(mock_test_items.duration_minutes) where package_id = liveTests.mockTestId
    const mockTestIds = allTests.map((t) => t.mockTestId);
    const durationRows =
      mockTestIds.length > 0
        ? await db
            .selectFrom("mockTestItems")
            .where("packageId", "in", mockTestIds)
            .select([
              "packageId",
              db.fn.sum<string>("durationMinutes").as("totalDuration"),
            ])
            .groupBy("packageId")
            .execute()
        : [];

    const durationByMockTestId = new Map<number, number>();
    for (const row of durationRows) {
      durationByMockTestId.set(row.packageId, parseFloat(row.totalDuration ?? "0"));
    }

    // Fetch the first test item ID for each mockTestId in a single batched query
    const firstItemRows =
      mockTestIds.length > 0
        ? await db
            .selectFrom("mockTestItems")
            .where("packageId", "in", mockTestIds)
            .select([
              "packageId",
            sql<number>`MIN(id)`.as("firstItemId"),
            sql<boolean>`bool_or(calculator_enabled)`.as("calculatorEnabled"),
            sql<boolean>`bool_or(subject_wise_timing)`.as("subjectWiseTiming"),
            sql<boolean>`bool_or(question_wise_timing)`.as("questionWiseTiming"),
            ])
            .groupBy("packageId")
            .execute()
        : [];
 
    const firstItemIdByMockTestId = new Map<number, number>();
    const calculatorEnabledByMockTestId = new Map<number, boolean>();
    const subjectWiseTimingByMockTestId = new Map<number, boolean>();
    const questionWiseTimingByMockTestId = new Map<number, boolean>();
    for (const row of firstItemRows) {
      firstItemIdByMockTestId.set(row.packageId, Number(row.firstItemId));
      calculatorEnabledByMockTestId.set(row.packageId, row.calculatorEnabled);
      subjectWiseTimingByMockTestId.set(row.packageId, row.subjectWiseTiming);
      questionWiseTimingByMockTestId.set(row.packageId, row.questionWiseTiming);
    }

    let testsWithStatus = allTests.map((test) => ({
      ...test,
      status: getLiveTestStatus(
        test.startTime || test.endTime,
        test.endTime,
        test.registrationDeadline || test.startTime || test.endTime,
        test.maxSeats,
        test.enrolledCount,
        test.isActive
      ),
      // Team managers do not see the owner's revenue.
      actualRevenue: teacherRole === "manager" ? 0 : revenueByLiveTestId.get(test.id) ?? 0,
      durationMinutes: durationByMockTestId.get(test.mockTestId) ?? 0,
      firstTestItemId: firstItemIdByMockTestId.get(test.mockTestId) ?? null,
      calculatorEnabled: calculatorEnabledByMockTestId.get(test.mockTestId) ?? false,
      subjectWiseTiming: subjectWiseTimingByMockTestId.get(test.mockTestId) ?? false,
      questionWiseTiming: questionWiseTimingByMockTestId.get(test.mockTestId) ?? false,
    }));

    const mockTestIdParam = url.searchParams.get("mockTestId");
    if (mockTestIdParam) {
      const mockTestId = parseInt(mockTestIdParam, 10);
      testsWithStatus = testsWithStatus.filter((test) => test.mockTestId === mockTestId);
    }

    if (filter) {
      const now = Date.now();
      testsWithStatus = testsWithStatus.filter((test) => matchesListFilter(test, filter, now));
      if (filter === "starting-soon") {
        testsWithStatus.sort(
          (a, b) => new Date(a.startTime ?? 0).getTime() - new Date(b.startTime ?? 0).getTime()
        );
      }
    } else if (status && status !== "all") {
      testsWithStatus = testsWithStatus.filter((test) => test.status === status);
    }

    const total = testsWithStatus.length;
    const paginatedTests = testsWithStatus.slice(offset, offset + limit);

    const responseData = paginatedTests.map(test => ({
      ...test,
      price: parseFloat(test.price),
      totalPrizePool: parseFloat(test.totalPrizePool),
      firstPrize: parseFloat(test.firstPrize),
      secondPrize: parseFloat(test.secondPrize),
      thirdPrize: parseFloat(test.thirdPrize),
      actualTotalDistributed: parseFloat(test.actualTotalDistributed),
      durationMinutes: test.durationMinutes,
      calculatorEnabled: test.calculatorEnabled,
      subjectWiseTiming: test.subjectWiseTiming,
      questionWiseTiming: test.questionWiseTiming,
    }));

    return new Response(
      superjson.stringify({
        tests: responseData,
        total,
        page,
        limit,
        mockTestIds,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch teacher's live tests:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch live tests.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}