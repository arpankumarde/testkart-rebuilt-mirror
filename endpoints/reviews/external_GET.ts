import superjson from "superjson";
import { loadExternalReviews } from "../../helpers/externalReviewsSource";
import type { OutputType } from "./external_GET.schema";

export async function handle(_request: Request): Promise<Response> {
  try {
    const feed = await loadExternalReviews();
    return new Response(superjson.stringify(feed satisfies OutputType), { status: 200 });
  } catch (error) {
    console.error("Failed to load external reviews:", error);
    return new Response(superjson.stringify({ error: "Failed to load reviews" }), { status: 500 });
  }
}
