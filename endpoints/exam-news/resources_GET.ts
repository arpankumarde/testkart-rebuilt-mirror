import superjson from "superjson";
import { schema, type OutputType } from "./resources_GET.schema";
import { fetchExamNewsResources } from "../../helpers/examNewsResourcesServer";

export async function handle(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      exam: params.get("exam") || undefined,
      all: params.get("all") === "1" || undefined,
    });
    const result = await fetchExamNewsResources(input);
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error loading exam news resources:", error);
    return new Response(superjson.stringify({ error: "Could not load resources" }), { status: 400 });
  }
}