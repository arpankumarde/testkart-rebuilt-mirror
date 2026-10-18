import superjson from "superjson";
import { schema, OutputType } from "./list_GET.schema";
import { examNewsPublicServer } from "../../helpers/examNewsPublicServer";

export async function handle(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page"));
    const input = schema.parse({
      type: params.get("type") || undefined,
      exam: params.get("exam") || undefined,
      q: params.get("q") || undefined,
      page: Number.isInteger(page) && page > 0 ? page : undefined,
    });
    const result = await examNewsPublicServer.fetchList(input);
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error listing public exam news:", error);
    return new Response(superjson.stringify({ error: "Could not load exam news" }), { status: 400 });
  }
}