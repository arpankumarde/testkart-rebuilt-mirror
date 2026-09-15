import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const liveTest = await db
      .selectFrom("liveTests")
      .selectAll()
      .where("id", "=", input.liveTestId)
      .executeTakeFirst();

    if (!liveTest) {
      return new Response(superjson.stringify({ error: "Live test not found" }), { status: 404 });
    }

    if (liveTest.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "You do not own this live test" }), { status: 403 });
    }

    if (liveTest.isActive) {
      return new Response(superjson.stringify({ error: "This live test is already published." }), { status: 400 });
    }

    const now = new Date();
    if (
      (liveTest.registrationDeadline && new Date(liveTest.registrationDeadline) < now) ||
      (liveTest.startTime && new Date(liveTest.startTime) < now) ||
      new Date(liveTest.endTime) < now
    ) {
      return new Response(
        superjson.stringify({
          error: "Cannot publish a test with a registration deadline, start time, or end time in the past.",
        }),
        { status: 400 }
      );
    }

    const questionCountResult = await db
      .selectFrom("mockTestItems")
      .innerJoin("testItemSubjects", "testItemSubjects.testItemId", "mockTestItems.id")
      .innerJoin("testQuestions", "testQuestions.subjectId", "testItemSubjects.id")
      .select(db.fn.count("testQuestions.id").as("count"))
      .where("mockTestItems.packageId", "=", liveTest.mockTestId)
      .executeTakeFirst();

    const totalQuestions = Number(questionCountResult?.count ?? 0);

    if (totalQuestions === 0) {
      return new Response(
        superjson.stringify({
          error: "Cannot publish a test with no questions. Please add at least one question.",
        }),
        { status: 400 }
      );
    }

    // Check teacher balance if this is a free test with prizes funded by teacher wallet
    if (liveTest.hasPrizes && liveTest.prizeFundSource === "teacher_wallet") {
      const totalPrizePool = parseFloat(liveTest.totalPrizePool);
      const teacherId = liveTest.teacherId;

      const balance = await getTeacherAvailableBalance(teacherId);

      if (balance.availableBalance < 0) {
        const balanceBeforeLock = balance.availableBalance + totalPrizePool;
        return new Response(
          superjson.stringify({
            error: `Insufficient balance to fund prize pool. Your available balance is ₹${balanceBeforeLock.toFixed(2)} but prize pool requires ₹${totalPrizePool.toFixed(2)}. Please add funds through test sales first.`,
          }),
          { status: 400 }
        );
      }

      console.log(
        `Live test ${liveTest.id} has sufficient teacher wallet balance for prize pool of ₹${totalPrizePool}. Available balance: ₹${balance.availableBalance}`
      );
    }

    // Publish the live test directly
    await db
      .updateTable("liveTests")
      .set({
        isActive: true,
      })
      .where("id", "=", liveTest.id)
      .execute();

    console.log(`Live test ${liveTest.id} published by teacher ${liveTest.teacherId}`);

    const output: OutputType = {
      success: true,
      message: "Your live test has been published successfully.",
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error publishing live test:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred" }), { status: 500 });
  }
}