import { schema, OutputType } from "./get_GET.schema";
import superjson from "superjson";
import { fetchExamContentServer } from "../../helpers/fetchExamContentServer";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const validatedInput = schema.parse({
      examSlug: url.searchParams.get("examSlug"),
      pageType: url.searchParams.get("pageType"),
    });

    const result = await fetchExamContentServer(validatedInput.examSlug, validatedInput.pageType);

    if (!result) {
      return new Response(superjson.stringify({ error: "Exam not found." }), { status: 404 });
    }

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("[exam-content/get_GET] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
