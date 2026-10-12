import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./reviews_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can review organisation pages." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const org = await db
      .selectFrom("organizations")
      .select(["id"])
      .where("id", "=", input.organizationId)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!org) {
      return new Response(
        superjson.stringify({ error: "Organisation not found." }),
        { status: 404 }
      );
    }

    const reviewText = input.reviewText && input.reviewText.length > 0 ? input.reviewText : null;

    const saved = await db
      .insertInto("organizationReviews")
      .values({
        organizationId: input.organizationId,
        studentId: user.id,
        rating: input.rating,
        reviewText,
      })
      .onConflict((oc) =>
        oc.columns(["organizationId", "studentId"]).doUpdateSet({
          rating: input.rating,
          reviewText,
          updatedAt: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    const statsRow = await db
      .selectFrom("organizationReviews")
      .select((eb) => [
        eb.fn.countAll<number>().as("count"),
        eb.fn.avg<number | null>("rating").as("avgRating"),
      ])
      .where("organizationId", "=", input.organizationId)
      .executeTakeFirst();

    const response: OutputType = {
      review: {
        id: saved.id,
        rating: saved.rating,
        reviewText: saved.reviewText,
        createdAt: saved.createdAt,
        isMine: true,
      },
      averageRating: statsRow?.avgRating != null ? Number(statsRow.avgRating) : null,
      totalCount: Number(statsRow?.count ?? 0),
    };

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Failed to submit organization review:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to submit review.", details: errorMessage }),
      { status: 500 }
    );
  }
}
