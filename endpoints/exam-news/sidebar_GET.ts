import superjson from "superjson";
import type { OutputType } from "./sidebar_GET.schema";
import { examNewsPublicServer } from "../../helpers/examNewsPublicServer";

export async function handle(_request: Request) {
  try {
    const result = await examNewsPublicServer.fetchSidebar();
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error loading exam news sidebar:", error);
    return new Response(superjson.stringify({ error: "Could not load exam news" }), { status: 400 });
  }
}