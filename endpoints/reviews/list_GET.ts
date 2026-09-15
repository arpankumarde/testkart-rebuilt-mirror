import { db } from "../../helpers/db";
import { schema, OutputType } from "./list_GET.schema";
import superjson from 'superjson';
import { ZodError } from "zod";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const mockTestId = url.searchParams.get('mockTestId');

    const validatedInput = schema.parse({ mockTestId });

    const reviews = await db
      .selectFrom("reviews")
      .innerJoin("users", "reviews.userId", "users.id")
      .leftJoin("mockTestItems", "reviews.testItemId", "mockTestItems.id")
      .select([
        "reviews.id",
        "reviews.rating",
        "reviews.reviewText",
        "reviews.createdAt",
        "reviews.testItemId",
        "users.displayName as reviewerName",
        "users.avatarUrl as reviewerAvatarUrl",
        "mockTestItems.title as testItemTitle",
      ])
      .where("reviews.mockTestId", "=", validatedInput.mockTestId)
      .orderBy("reviews.createdAt", "desc")
      .execute();

    return new Response(superjson.stringify({ reviews } satisfies OutputType));
  } catch (error) {
    console.error("Error fetching reviews:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid mockTestId provided." }), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred." }), { status: 500 });
  }
}