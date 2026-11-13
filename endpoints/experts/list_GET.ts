import superjson from "superjson";
import { fetchExpertsListServer } from "../../helpers/fetchExpertsListServer";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const param = (key: string) => url.searchParams.get(key) ?? undefined;
    const output = await fetchExpertsListServer({
      search: param("search"),
      minPrice: param("minPrice"),
      maxPrice: param("maxPrice"),
      verifiedOnly: param("verifiedOnly"),
      sortBy: param("sortBy"),
      page: param("page"),
      limit: param("limit"),
    });
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing experts:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}