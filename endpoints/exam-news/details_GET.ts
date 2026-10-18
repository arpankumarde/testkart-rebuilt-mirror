import superjson from "superjson";
import { schema, OutputType } from "./details_GET.schema";
import { examNewsPublicServer } from "../../helpers/examNewsPublicServer";

export async function handle(request: Request) {
  try {
    const input = schema.parse({ slug: new URL(request.url).searchParams.get("slug") ?? "" });
    const result = await examNewsPublicServer.fetchDetail(input.slug);
    if (!result) {
      return new Response(superjson.stringify({ error: "Story not found" }), { status: 404 });
    }
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error loading public exam news story:", error);
    return new Response(superjson.stringify({ error: "Could not load this story" }), { status: 400 });
  }
}