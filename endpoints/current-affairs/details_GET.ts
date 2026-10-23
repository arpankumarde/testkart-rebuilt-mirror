import superjson from "superjson";
import { schema, OutputType } from "./details_GET.schema";
import { currentAffairsPublicServer } from "../../helpers/currentAffairsPublicServer";

export async function handle(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      slug: params.get("slug") || undefined,
      type: params.get("type") || undefined,
    });
    const result = input.type
      ? await currentAffairsPublicServer.fetchArchiveDetail(input.type, input.slug)
      : await currentAffairsPublicServer.fetchDetail(input.slug);
    if (!result) {
      return new Response(superjson.stringify({ error: "Article not found" }), { status: 404 });
    }
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error loading public current affairs article:", error);
    return new Response(superjson.stringify({ error: "Could not load this article" }), { status: 400 });
  }
}
