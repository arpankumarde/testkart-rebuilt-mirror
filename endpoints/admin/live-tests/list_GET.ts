import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const liveTests = await db
      .selectFrom("liveTests")
      .innerJoin("users", "users.id", "liveTests.teacherId")
      .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
      .select([
        "liveTests.id",
        "liveTests.title",
        "liveTests.startTime",
        "liveTests.endTime",
        "liveTests.enrolledCount",
        "liveTests.maxSeats",
        "liveTests.price",
        "liveTests.isActive",
        "liveTests.hasPrizes",
        "liveTests.totalPrizePool",
        "liveTests.prizeDistributionStatus",
        "liveTests.createdAt",
        "users.displayName as teacherName",
        "users.id as teacherId",
        "mockTests.title as mockTestTitle",
      ])
      .orderBy("liveTests.createdAt", "desc")
      .execute();

    const output: OutputType = liveTests.map((test) => ({
      ...test,
      price: Number(test.price),
      totalPrizePool: Number(test.totalPrizePool),
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin live tests list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}