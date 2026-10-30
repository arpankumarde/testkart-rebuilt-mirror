import superjson from "superjson";
import type { OutputType } from "./page_GET.schema";
import { gecServer } from "../../helpers/gecServer";

export async function handle() {
  try {
    const payload: OutputType = await gecServer.loadPublic();
    return new Response(superjson.stringify(payload), {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("Error loading the published govt exams calendar:", error);
    return new Response(superjson.stringify({ error: "Could not load the calendar" }), { status: 500 });
  }
}