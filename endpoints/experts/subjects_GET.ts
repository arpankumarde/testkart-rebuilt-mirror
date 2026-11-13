import superjson from "superjson";
import { fetchExpertSubjectsServer } from "../../helpers/fetchExpertSubjectsServer";

export async function handle(_request: Request) {
  try {
    const output = await fetchExpertSubjectsServer();
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing expert subjects:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}