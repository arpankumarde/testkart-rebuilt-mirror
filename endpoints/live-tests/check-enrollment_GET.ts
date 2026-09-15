import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType } from "./check-enrollment_GET.schema";
import superjson from "superjson";
import { z } from "zod";

const inputSchema = z.object({
  liveTestId: z.coerce.number().int().positive(),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({
          error: "Only students can check enrollment status.",
        }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const liveTestId = url.searchParams.get("liveTestId");

    const validationResult = inputSchema.safeParse({ liveTestId });
    if (!validationResult.success) {
      return new Response(
        superjson.stringify({ error: "A valid live test ID is required." }),
        { status: 400 }
      );
    }

    const validatedLiveTestId = validationResult.data.liveTestId;

    const liveTest = await db
      .selectFrom("liveTests")
      .selectAll()
      .where("id", "=", validatedLiveTestId)
      .executeTakeFirst();

    if (!liveTest) {
      return new Response(
        superjson.stringify({ error: "Live test not found." }),
        { status: 404 }
      );
    }

    const enrollment = await db
      .selectFrom("liveTestEnrollments")
      .select("id")
      .where("studentId", "=", user.id)
      .where("liveTestId", "=", validatedLiveTestId)
      .executeTakeFirst();

    const isEnrolled = !!enrollment;
    let canEnroll = false;
    let reason: string | null = null;

        if (isEnrolled) {
      reason = "You are already enrolled in this test.";
    } else if (liveTest.registrationDeadline && new Date() > liveTest.registrationDeadline) {
      reason = "Registration for this live test has closed.";
    } else if (!liveTest.registrationDeadline && new Date() > liveTest.endTime) {
      reason = "This live test has ended.";
    } else if (liveTest.enrolledCount >= liveTest.maxSeats) {
      reason = "This live test is full.";
    } else {
      canEnroll = true;
    }

    return new Response(
      superjson.stringify({
        isEnrolled,
        canEnroll,
        reason,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to check enrollment status:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to check enrollment status.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}