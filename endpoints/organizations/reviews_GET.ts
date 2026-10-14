import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType, OrganizationReviewItem } from "./reviews_GET.schema";
import superjson from "superjson";

const PAGE_SIZE = 20;

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({
      organizationId: url.searchParams.get("organizationId"),
      page: url.searchParams.get("page") ?? undefined,
    });

    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch {
      // Public, unauthenticated-ok endpoint.
    }

    const offset = (input.page - 1) * PAGE_SIZE;

    const [rows, statsRow, myReviewRow, distributionRows] = await Promise.all([
      db
        .selectFrom("organizationReviews")
        .select(["id", "rating", "reviewText", "createdAt", "studentId"])
        .where("organizationId", "=", input.organizationId)
        .orderBy("createdAt", "desc")
        .limit(PAGE_SIZE)
        .offset(offset)
        .execute(),
      db
        .selectFrom("organizationReviews")
        .select((eb) => [
          eb.fn.countAll<number>().as("count"),
          eb.fn.avg<number | null>("rating").as("avgRating"),
        ])
        .where("organizationId", "=", input.organizationId)
        .executeTakeFirst(),
      userId !== null
        ? db
            .selectFrom("organizationReviews")
            .select(["id", "rating", "reviewText", "createdAt"])
            .where("organizationId", "=", input.organizationId)
            .where("studentId", "=", userId)
            .executeTakeFirst()
        : Promise.resolve(null),
      db
        .selectFrom("organizationReviews")
        .select((eb) => ["rating", eb.fn.countAll<number>().as("count")])
        .where("organizationId", "=", input.organizationId)
        .groupBy("rating")
        .execute(),
    ]);

    const reviews: OrganizationReviewItem[] = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
      isMine: userId !== null && r.studentId === userId,
    }));

    const totalCount = Number(statsRow?.count ?? 0);
    const countByStars = new Map(distributionRows.map((row) => [Number(row.rating), Number(row.count)]));

    const response: OutputType = {
      reviews,
      totalCount,
      averageRating: statsRow?.avgRating != null ? Number(statsRow.avgRating) : null,
      page: input.page,
      pageSize: PAGE_SIZE,
      hasMore: offset + rows.length < totalCount,
      myReview: myReviewRow
        ? {
            id: myReviewRow.id,
            rating: myReviewRow.rating,
            reviewText: myReviewRow.reviewText,
            createdAt: myReviewRow.createdAt,
            isMine: true,
          }
        : null,
      distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: countByStars.get(stars) ?? 0 })),
    };

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Failed to fetch organization reviews:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to load reviews.", details: errorMessage }),
      { status: 500 }
    );
  }
}
