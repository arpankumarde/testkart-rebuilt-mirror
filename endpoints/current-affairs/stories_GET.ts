import superjson from "superjson";
import { schema, OutputType } from "./stories_GET.schema";
import { currentAffairsPublicServer } from "../../helpers/currentAffairsPublicServer";

export async function handle(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page"));
    const input = schema.parse({
      lang: params.get("lang") || undefined,
      page: Number.isFinite(page) && page > 0 ? page : undefined,
    });
    const result = await currentAffairsPublicServer.fetchDailyStories(input);
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error listing public daily stories:", error);
    return new Response(superjson.stringify({ error: "Could not load daily stories" }), { status: 400 });
  }
}