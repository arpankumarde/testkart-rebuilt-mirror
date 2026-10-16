import superjson from "superjson";
import { schema, OutputType } from "./details_GET.schema";
import { currentAffairsPublicServer } from "../../helpers/currentAffairsPublicServer";

export async function handle(request: Request) {
  try {
    const input = schema.parse({ slug: new URL(request.url).searchParams.get("slug") ?? "" });
    const result = await currentAffairsPublicServer.fetchDetail(input.slug);
    if (!result) {
      return new Response(superjson.stringify({ error: "Digest not found" }), { status: 404 });
    }
    return new Response(superjson.stringify({ post: result.post } satisfies OutputType));
  } catch (error) {
    console.error("Error loading public current affairs digest:", error);
    return new Response(superjson.stringify({ error: "Could not load this digest" }), { status: 400 });
  }
}