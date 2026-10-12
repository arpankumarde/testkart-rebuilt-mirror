import superjson from "superjson";
import { OutputType } from "./directory_GET.schema";
import { fetchExamDirectoryServer } from "../../helpers/fetchExamDirectoryServer";

export async function handle(request: Request): Promise<Response> {
  try {
    const result = await fetchExamDirectoryServer();
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("[exams/directory_GET] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
