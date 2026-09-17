import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB } from "../../../helpers/schema";
import { assertTeacherCanFundPrizePool } from "../../../helpers/liveTestPrizeFunding";

async function validateTestContent(testId: number, trx: Transaction<DB>) {
  // Check for at least one test item
  const testItems = await trx
    .selectFrom("mockTestItems")
    .select("id")
    .where("packageId", "=", testId)
    .execute();

  if (testItems.length === 0) {
    throw new Error("The test must contain at least one test item (e.g., a section or paper) before publishing.");
  }

  // Check each item has questions
  for (const item of testItems) {
    const questionCountResult = await trx
      .selectFrom("testQuestions")
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .where("testId", "=", item.id)
      .executeTakeFirst();

    const questionCount = parseInt(questionCountResult?.count ?? "0", 10);

    if (questionCount === 0) {
      throw new Error(`Test item ID ${item.id} must have at least one question before publishing.`);
    }
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

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    const { testId } = input;

    // Run all validations and publish in a transaction
    await db.transaction().execute(async (trx) => {
      // 1. Find the live test and its associated mock test
      const liveTest = await trx
        .selectFrom("liveTests")
        .innerJoin("mockTests", "liveTests.mockTestId", "mockTests.id")
        .selectAll("liveTests")
        .select(["mockTests.isPublished"])
        .where("liveTests.mockTestId", "=", testId)
        .executeTakeFirst();

      // 2. Check if live test exists
      if (!liveTest) {
        throw new Error("Live test not found.");
      }

      // Authorization check
      if (user.role !== "admin" && liveTest.teacherId !== effectiveTeacherId) {
        throw new Error("You are not authorized to publish this live test.");
      }

      // Publishing commits the prize pool against the owner's earnings.
      if (teacherRole === "manager" && liveTest.hasPrizes) {
        throw new Error("You are not authorized to publish a live test with prize money. Ask the account owner to publish it.");
      }

      // 3. Idempotency check
      if (liveTest.isPublished && liveTest.isActive) {
        throw new Error("Live test is already published.");
      }

      // 4. Validate schedule
      const now = new Date();
      if (liveTest.registrationDeadline && liveTest.registrationDeadline <= now) {
        throw new Error("Cannot publish a live test whose registration deadline has already passed.");
      }
      if (liveTest.registrationDeadline && liveTest.startTime && liveTest.registrationDeadline >= liveTest.startTime) {
        throw new Error("Registration deadline must be before the start time.");
      }
      if (liveTest.startTime && liveTest.startTime >= liveTest.endTime) {
        throw new Error("Start time must be before the end time.");
      }

      // 5. Content validation
      await validateTestContent(testId, trx);

      // 6. A free test's prize pool is paid from the teacher's wallet
      await assertTeacherCanFundPrizePool(trx, liveTest);

      // 7. Publish the live test directly
      await trx
        .updateTable("liveTests")
        .set({
          isActive: true,
        })
        .where("mockTestId", "=", testId)
        .execute();

      console.log(`Live test (mockTestId: ${testId}) published by teacher ${liveTest.teacherId}`);
    });

    const output: OutputType = {
      success: true,
      message: "Your live test has been published successfully.",
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error publishing live test:", error);
    if (error instanceof Error) {
      let status = 400;
      if (error.message.includes("not found")) status = 404;
            if (error.message.includes("not authorized")) status = 403;

      return new Response(superjson.stringify({ error: error.message }), {
        status,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}