import superjson from "superjson";
import { schema, OutputType } from "./hub_GET.schema";
import { currentAffairsPublicServer } from "../../helpers/currentAffairsPublicServer";

export async function handle(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const input = schema.parse({ lang: params.get("lang") || undefined });
    const result = await currentAffairsPublicServer.fetchHub(input.lang);
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error loading current affairs hub:", error);
    return new Response(superjson.stringify({ error: "Could not load current affairs" }), { status: 500 });
  }
}