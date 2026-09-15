import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./start-attempt_POST.schema";
import superjson from "superjson";
import { hasStudentAccessToTestItem } from "../../../helpers/hasStudentPurchasedTestItem";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can start a test." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const hasAccess = await hasStudentAccessToTestItem(
      user.id,
      input.testItemId
    );
    if (!hasAccess) {
      return new Response(
        superjson.stringify({
          error: "You have not purchased this test or it is not available.",
        }),
        { status: 403 }
      );
    }

    const testItem = await db
      .selectFrom("mockTestItems")
      .select(["totalQuestions", "packageId", "scheduledDate"])
      .where("id", "=", input.testItemId)
      .executeTakeFirst();

    if (!testItem) {
      return new Response(
        superjson.stringify({ error: "Test item not found." }),
        { status: 404 }
      );
    }

    // Check if the test is scheduled for a future date
    if (testItem.scheduledDate) {
      const now = new Date();
      const scheduledDate = new Date(testItem.scheduledDate);
      
      if (now < scheduledDate) {
        const formattedDate = scheduledDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });
        
        return new Response(
          superjson.stringify({
            error: `This test is not yet available. It will be available on ${formattedDate}.`,
          }),
          { status: 403 }
        );
      }
    }

    // Check if this test item is part of a live test
    const liveTest = await db
      .selectFrom("liveTests")
      .select("id")
      .where("mockTestId", "=", testItem.packageId)
      .executeTakeFirst();

    // If it's a live test, enforce the 1 attempt limit
    if (liveTest) {
      const existingAttempt = await db
        .selectFrom("testAttempts")
        .select("id")
        .where("studentId", "=", user.id)
        .where("testId", "=", input.testItemId)
        .executeTakeFirst();

      if (existingAttempt) {
        return new Response(
          superjson.stringify({
            error:
              "You have already attempted this live test. Only one attempt is allowed per live test.",
          }),
          { status: 403 }
        );
      }
    }

    const startedAt = new Date();
    const newAttempt = await db
      .insertInto("testAttempts")
      .values({
        studentId: user.id,
        testId: input.testItemId,
        startedAt: startedAt,
        totalQuestions: testItem.totalQuestions,
      })
      .returning(["id", "startedAt"])
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
              attemptId: newAttempt.id,
      startedAt: newAttempt.startedAt ?? new Date(),
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error starting test attempt:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}