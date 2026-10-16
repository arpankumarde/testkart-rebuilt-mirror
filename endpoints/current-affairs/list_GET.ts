import superjson from "superjson";
import { schema, OutputType } from "./list_GET.schema";
import { currentAffairsPublicServer } from "../../helpers/currentAffairsPublicServer";

export async function handle(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page"));
    const input = schema.parse({
      type: params.get("type") || undefined,
      topic: params.get("topic") || undefined,
      exam: params.get("exam") || undefined,
      lang: params.get("lang") || undefined,
      page: Number.isFinite(page) && page > 0 ? page : undefined,
    });
    const result = await currentAffairsPublicServer.fetchList(input);
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error listing public current affairs:", error);
    return new Response(superjson.stringify({ error: "Could not load current affairs" }), { status: 400 });
  }
}