import { OutputType, schema } from "./details_GET.schema";
import superjson from "superjson";
import { fetchNewsDetailServer } from "../../helpers/fetchNewsDetailServer";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({ slug: url.searchParams.get("slug") ?? "" });

    const result = await fetchNewsDetailServer(input.slug);

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    if (error instanceof Error && error.message === "Not found") {
      return new Response(
        superjson.stringify({ error: "News coverage not found" }),
        { status: 404 }
      );
    }

    console.error("Error fetching news coverage details:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 500 }
    );
  }
}
