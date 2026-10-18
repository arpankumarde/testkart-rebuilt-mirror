import superjson from "superjson";
import { schema, OutputType } from "./details_GET.schema";
import { currentAffairsPublicServer } from "../../helpers/currentAffairsPublicServer";

export async function handle(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      slug: params.get("slug") || undefined,
      type: params.get("type") || undefined,
      period: params.get("period") || undefined,
    });
    const result =
      input.type && input.period
        ? await currentAffairsPublicServer.fetchDetailByPeriod(input.type, input.period)
        : await currentAffairsPublicServer.fetchDetail(input.slug!);
    if (!result) {
      return new Response(superjson.stringify({ error: "Digest not found" }), { status: 404 });
    }
    return new Response(superjson.stringify({ post: result.post, canonicalPath: result.canonicalPath } satisfies OutputType));
  } catch (error) {
    console.error("Error loading public current affairs digest:", error);
    return new Response(superjson.stringify({ error: "Could not load this digest" }), { status: 400 });
  }
}