import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { fetchNewsListServer } from "../../helpers/fetchNewsListServer";

export async function handle(request: Request) {
  try {
    // Published entries, newest first. Shares its query with the SSR prefetch.
    const result = await fetchNewsListServer();

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error fetching news coverage list:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 500 }
    );
  }
}
