import { db } from "../../../helpers/db";
import { OutputType } from "./latest_GET.schema";
import superjson from 'superjson';
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (!user || user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const reviews = await db
      .selectFrom("reviews")
      .innerJoin("mockTests", "mockTests.id", "reviews.mockTestId")
      .select([
        "reviews.id",
        "reviews.rating",
        "reviews.reviewText",
        "reviews.reviewerName",
        "reviews.createdAt",
        "reviews.mockTestId",
        "mockTests.title as mockTestTitle",
      ])
      .where("mockTests.teacherId", "=", effectiveTeacherId)
      .orderBy("reviews.createdAt", "desc")
      .limit(10)
      .execute();

    return new Response(superjson.stringify({ reviews } satisfies OutputType));
  } catch (error) {
    console.error("Error fetching latest teacher reviews:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred." }), { status: 500 });
  }
}