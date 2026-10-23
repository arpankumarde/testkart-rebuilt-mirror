import superjson from "superjson";
import { schema, OutputType } from "./details_GET.schema";
import { glossaryPublicServer } from "../../helpers/glossaryPublicServer";

export async function handle(request: Request) {
  try {
    const input = schema.parse({ slug: new URL(request.url).searchParams.get("slug") ?? "" });
    const result = await glossaryPublicServer.fetchDetail(input.slug);
    if (!result) {
      return new Response(superjson.stringify({ error: "Term not found" }), { status: 404 });
    }
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error loading public glossary term:", error);
    return new Response(superjson.stringify({ error: "Could not load this term" }), { status: 400 });
  }
}