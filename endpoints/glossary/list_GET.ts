import superjson from "superjson";
import type { OutputType } from "./list_GET.schema";
import { glossaryPublicServer } from "../../helpers/glossaryPublicServer";

export async function handle() {
  try {
    const terms = await glossaryPublicServer.fetchTerms();
    return new Response(superjson.stringify({ terms } satisfies OutputType));
  } catch (error) {
    console.error("Error loading the glossary:", error);
    return new Response(superjson.stringify({ error: "Could not load the glossary" }), { status: 400 });
  }
}