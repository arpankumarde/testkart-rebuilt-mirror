import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType } from "./enrolled-live-tests_GET.schema";
import superjson from "superjson";
import { getLiveTestStatus } from "../../helpers/liveTestStatus";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized access" }),
        { status: 403 }
      );
    }

    const rawTests = await db
      .selectFrom("liveTestEnrollments")
      .innerJoin("liveTests", "liveTests.id", "liveTestEnrollments.liveTestId")
      .innerJoin("users as teacher", "teacher.id", "liveTests.teacherId")
      .select(({ eb }) => [
        "liveTests.id",
        "liveTests.title",
        "liveTests.description",
        "liveTests.thumbnailUrl",
        "liveTests.price",
        "liveTests.startTime",
        "liveTests.endTime",
        "liveTests.registrationDeadline",
        "teacher.displayName as teacherName",
        "liveTests.enrolledCount",
        "liveTests.maxSeats",
        "liveTests.hasPrizes",
        "liveTests.totalPrizePool",
        "liveTests.firstPrize",
        "liveTests.secondPrize",
        "liveTests.thirdPrize",
        "liveTests.mockTestId",
        "liveTestEnrollments.enrolledAt",
        eb
          .exists(
            eb
              .selectFrom("testAttempts")
              .innerJoin(
                "mockTestItems",
                "mockTestItems.id",
                "testAttempts.testId"
              )
              .whereRef(
                "mockTestItems.packageId",
                "=",
                "liveTests.mockTestId"
              )
              .where("testAttempts.studentId", "=", user.id)
              .where("testAttempts.completedAt", "is not", null)
              .where((eb) =>
                eb.or([
                  eb("liveTests.startTime", "is", null),
                  eb(
                    "testAttempts.startedAt",
                    ">=",
                    eb.ref("liveTests.startTime")
                  ),
                ])
              )
              .whereRef(
                "testAttempts.completedAt",
                "<=",
                "liveTests.endTime"
              )
          )
          .as("hasAttempted"),
      ])
      .where("liveTestEnrollments.studentId", "=", user.id)
      .orderBy("liveTests.endTime", "desc")
      .execute();

    const enrolledLiveTests = rawTests.map((test) => {
      const status = getLiveTestStatus({
        startTime: test.startTime,
        endTime: test.endTime,
        registrationDeadline: test.registrationDeadline,
        maxSeats: test.maxSeats,
        enrolledCount: test.enrolledCount,
      });

      return {
        id: test.id,
        title: test.title,
        description: test.description,
        thumbnailUrl: test.thumbnailUrl,
        price: test.price,
        startTime: test.startTime,
        endTime: test.endTime,
        teacherName: test.teacherName,
        enrolledCount: test.enrolledCount,
        maxSeats: test.maxSeats,
        hasPrizes: test.hasPrizes,
        totalPrizePool: test.totalPrizePool,
        firstPrize: test.firstPrize,
        secondPrize: test.secondPrize,
        thirdPrize: test.thirdPrize,
        status,
        hasAttempted: Boolean(test.hasAttempted),
        mockTestId: test.mockTestId,
        enrolledAt: test.enrolledAt,
      };
    });

    return new Response(
      superjson.stringify({
        enrolledLiveTests,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch enrolled live tests:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch enrolled live tests.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}