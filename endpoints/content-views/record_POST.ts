import superjson from "superjson";
import { schema, OutputType } from "./record_POST.schema";
import { contentViewsServer } from "../../helpers/contentViewsServer";

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));
    const outcome = await contentViewsServer.record(request, input.kind, input.id);
    return new Response(superjson.stringify({ counted: outcome === "counted" } satisfies OutputType));
  } catch (error) {
    console.error("Error recording a content view:", error);
    return new Response(superjson.stringify({ error: "Could not record the view" }), { status: 400 });
  }
}
