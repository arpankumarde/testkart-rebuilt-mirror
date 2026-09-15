import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType, EnrolledTest } from "./enrolled-tests_GET.schema";
import superjson from "superjson";
import { slugify } from "../../helpers/slugify";

type EnrolledTestRow = {
  id: number;
  title: string;
  description: string | null;
  subject: string | null;
  price: string;
  thumbnailUrl: string | null;
  examName: string | null;
  teacherId: number;
  creatorName: string | null;
  totalTests: number;
  freeTestsCount: number;
  studentsEnrolled: number;
  rating: string | null;
  reviewsCount: number;
  durationMinutes: number;
  totalQuestions: number;
  slug: string;
  isPublished: boolean;
  enrolledAt: Date | null;
  examSlug: string | null;
  hasReviewed: boolean | null;
};

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    console.log(`Fetching enrolled tests for student ${user.id}`);

    const enrolledTests: EnrolledTestRow[] = await db
      .selectFrom("mockTestEnrollments")
      .innerJoin("mockTests", "mockTests.id", "mockTestEnrollments.mockTestId")
      .leftJoin("liveTests", "liveTests.mockTestId", "mockTests.id")
      .leftJoin("exams", "exams.examName", "mockTests.examName")
      .leftJoin("reviews", (join) =>
        join
          .onRef("reviews.mockTestId", "=", "mockTests.id")
          .on("reviews.userId", "=", user.id)
      )
      .select([
        "mockTests.id",
        "mockTests.title",
        "mockTests.description",
        "mockTests.subject",
        "mockTests.price",
        "mockTests.thumbnailUrl",
        "mockTests.examName",
        "mockTests.teacherId",
        "mockTests.creatorName",
        "mockTests.totalTests",
        "mockTests.freeTestsCount",
        "mockTests.studentsEnrolled",
        "mockTests.rating",
        "mockTests.reviewsCount",
        "mockTests.durationMinutes",
        "mockTests.totalQuestions",
        "mockTests.slug",
        "mockTests.isPublished",
        "mockTestEnrollments.enrolledAt",
        "exams.examSlug",
      ])
      .select((eb) => [
        eb
          .case()
          .when("reviews.id", "is not", null)
          .then(true)
          .else(false)
          .end()
          .as("hasReviewed"),
      ])
      .where("mockTestEnrollments.studentId", "=", user.id)
      .where("liveTests.id", "is", null)
      .orderBy("mockTestEnrollments.enrolledAt", "desc")
      .execute();

    console.log(
      `Found ${enrolledTests.length} enrolled tests for student ${user.id}`
    );

    if (enrolledTests.length === 0) {
      return new Response(
        superjson.stringify({
          enrolledTests: [],
        } satisfies OutputType)
      );
    }

   const packageIds = enrolledTests.map((test) => test.id);

   // Fetch ALL test items for ALL enrolled packages in one query (Batched)
   const testItemsData = await db
      .selectFrom("mockTestItems")
      .leftJoin("testAttempts", (join) =>
        join
          .onRef("testAttempts.testId", "=", "mockTestItems.id")
          .on("testAttempts.studentId", "=", user.id)
      )
      .select([
        "mockTestItems.packageId",
        "mockTestItems.id",
        "mockTestItems.title",
        "mockTestItems.description",
        "mockTestItems.subject",
        "mockTestItems.durationMinutes",
        "mockTestItems.isFree",
        "mockTestItems.orderIndex",
        "mockTestItems.scheduledDate",
      ])
      .select((eb) => [
        eb
          .selectFrom("testQuestions")
          .innerJoin(
            "testItemSubjects",
            "testItemSubjects.testItemId",
            "mockTestItems.id"
          )
          .whereRef("testQuestions.subjectId", "=", "testItemSubjects.id")
          .select(eb.fn.countAll<number>().as("count"))
          .as("actualTotalQuestions"),
        eb.fn.count<number>("testAttempts.id").as("attemptsCount"),
        eb.fn
          .count<number>("testAttempts.id")
          .filterWhere("testAttempts.completedAt", "is not", null)
          .as("completedAttemptsCount"),
        eb.fn.max("testAttempts.score").as("bestScore"),
        eb.fn.max("testAttempts.startedAt").as("lastAttemptedAt"),
      ])
      // Students who already bought the package see only its live tests. A
      // trashed item is one the teacher has withdrawn — it stays attemptable
      // through a direct link (access is gated by enrollment, not by this
      // query), but it must not be offered up in "My Tests" as if it were
      // still part of the series.
      .where("mockTestItems.packageId", "in", packageIds)
      .where("mockTestItems.deletedAt", "is", null)
      .groupBy([
        "mockTestItems.packageId",
        "mockTestItems.id",
        "mockTestItems.title",
        "mockTestItems.description",
        "mockTestItems.subject",
        "mockTestItems.durationMinutes",
        "mockTestItems.isFree",
        "mockTestItems.orderIndex",
      ])
      .orderBy("mockTestItems.orderIndex", "asc")
      .execute();

   // Group test items by packageId in JavaScript
   const testItemsByPackage = new Map<number, (typeof testItemsData)[number][]>();
    for (const item of testItemsData) {
      const items = testItemsByPackage.get(item.packageId) || [];
      items.push(item);
      testItemsByPackage.set(item.packageId, items);
    }

    // Build progress data from grouped items
    const enrolledTestsWithProgress: EnrolledTest[] = enrolledTests.map((test) => {
      const items = testItemsByPackage.get(test.id) || [];

      const processedTestItems = items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        subject: item.subject,
        durationMinutes: item.durationMinutes,
        totalQuestions: Number(item.actualTotalQuestions ?? 0),
        isFree: item.isFree,
        orderIndex: item.orderIndex,
        scheduledDate: item.scheduledDate,
        attemptsCount: Number(item.attemptsCount),
        completedAttemptsCount: Number(item.completedAttemptsCount),
        bestScore: item.bestScore ? parseFloat(item.bestScore) : null,
        lastAttemptedAt: item.lastAttemptedAt,
        isCompleted: Number(item.completedAttemptsCount) > 0,
      }));

      const totalItems = processedTestItems.length;
      const completedItems = processedTestItems.filter((item) => item.isCompleted).length;
      const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

      const completedItemsWithScores = processedTestItems.filter(
        (item) => item.bestScore !== null
      );
      const averageScore =
        completedItemsWithScores.length > 0
          ? completedItemsWithScores.reduce(
              (sum, item) => sum + (item.bestScore || 0),
              0
            ) / completedItemsWithScores.length
          : null;

      const examSlug =
        test.examSlug ||
        (test.examName ? slugify(test.examName) : null) ||
        "general-exam";

      return {
        id: test.id,
        title: test.title,
        description: test.description,
        subject: test.subject,
        price: test.price,
        thumbnailUrl: test.thumbnailUrl,
        examName: test.examName,
        teacherId: test.teacherId,
        creatorName: test.creatorName,
        totalTests: test.totalTests,
        freeTestsCount: test.freeTestsCount,
        studentsEnrolled: test.studentsEnrolled,
        rating: test.rating,
        reviewsCount: test.reviewsCount,
        durationMinutes: test.durationMinutes,
        totalQuestions: test.totalQuestions,
        slug: test.slug,
        isPublished: test.isPublished,
        enrolledAt: test.enrolledAt,
        testItems: processedTestItems,
        totalItems,
        completedItems,
        progressPercentage,
        averageScore,
        hasReviewed: test.hasReviewed ?? false,
        examSlug,
      };
    });

    return new Response(
      superjson.stringify({
        enrolledTests: enrolledTestsWithProgress,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch enrolled tests:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch enrolled tests.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}