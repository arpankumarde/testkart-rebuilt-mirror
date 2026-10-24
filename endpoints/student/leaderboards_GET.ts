import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { LeaderboardSeries, OutputType } from "./leaderboards_GET.schema";
import superjson from "superjson";

/*
 * The test series whose leaderboards the signed-in student may open, most
 * recent activity first. Same rule as helpers/testSeriesLeaderboardAccess:
 * enrolled in the series, or at least one attempt on any of its papers.
 * Live-test shadow series are left out; their rankings live on the live test.
 */
export async function handle(request: Request) {
  let user;
  try {
    ({ user } = await getServerUserSession(request));
  } catch {
    return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  try {
    const [enrollments, attempts] = await Promise.all([
      db
        .selectFrom("mockTestEnrollments")
        .select(["mockTestId", "enrolledAt"])
        .where("studentId", "=", user.id)
        .execute(),
      db
        .selectFrom("testAttempts")
        .innerJoin("mockTestItems", "mockTestItems.id", "testAttempts.testId")
        .select(["mockTestItems.packageId"])
        .select((eb) => eb.fn.max("testAttempts.startedAt").as("lastAttemptedAt"))
        .where("testAttempts.studentId", "=", user.id)
        .groupBy("mockTestItems.packageId")
        .execute(),
    ]);

    const enrolledIds = new Set(enrollments.map((e) => e.mockTestId));
    const lastActivity = new Map<number, number>();
    const touch = (id: number, at: Date | string | null) => {
      const time = at ? new Date(at).getTime() : 0;
      lastActivity.set(id, Math.max(lastActivity.get(id) ?? 0, time));
    };
    enrollments.forEach((e) => touch(e.mockTestId, e.enrolledAt));
    attempts.forEach((a) => touch(a.packageId, a.lastAttemptedAt as Date | null));

    const seriesIds = [...lastActivity.keys()];
    if (seriesIds.length === 0) {
      return new Response(superjson.stringify({ series: [] } satisfies OutputType));
    }

    const [seriesRows, itemRows] = await Promise.all([
      db
        .selectFrom("mockTests")
        .select(["id", "title", "slug", "thumbnailUrl", "examName"])
        .where("id", "in", seriesIds)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb.selectFrom("liveTests").select("liveTests.id").whereRef("liveTests.mockTestId", "=", "mockTests.id")
            )
          )
        )
        .execute(),
      db
        .selectFrom("mockTestItems")
        .select(["id", "title", "packageId"])
        .where("packageId", "in", seriesIds)
        .where("deletedAt", "is", null)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("testItemSubjects")
              .innerJoin("testQuestions", "testQuestions.subjectId", "testItemSubjects.id")
              .select("testQuestions.id")
              .whereRef("testItemSubjects.testItemId", "=", "mockTestItems.id")
          )
        )
        .orderBy("orderIndex", "asc")
        .execute(),
    ]);

    const itemsBySeries = new Map<number, LeaderboardSeries["items"]>();
    for (const item of itemRows) {
      const list = itemsBySeries.get(item.packageId) ?? [];
      list.push({ id: item.id, title: item.title });
      itemsBySeries.set(item.packageId, list);
    }

    const series: LeaderboardSeries[] = seriesRows
      .map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        thumbnailUrl: row.thumbnailUrl,
        examName: row.examName,
        access: enrolledIds.has(row.id) ? ("enrolled" as const) : ("attempted" as const),
        items: itemsBySeries.get(row.id) ?? [],
      }))
      .filter((row) => row.items.length > 0)
      .sort((a, b) => (lastActivity.get(b.id) ?? 0) - (lastActivity.get(a.id) ?? 0));

    return new Response(superjson.stringify({ series } satisfies OutputType));
  } catch (error) {
    console.error("Failed to fetch student leaderboards:", error);
    return new Response(
      superjson.stringify({
        error: "Failed to fetch leaderboards.",
        details: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      { status: 500 }
    );
  }
}