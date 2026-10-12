import superjson from "superjson";
import { schema, OutputType } from "./by-slug_GET.schema";
import { fetchExamBySlugServer } from "../../helpers/fetchExamBySlugServer";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { examSlug } = schema.parse({ examSlug: url.searchParams.get("examSlug") });

    const exam = await fetchExamBySlugServer(examSlug);
    const result: OutputType = {
      exam: exam
        ? {
            id: exam.id,
            examName: exam.examName,
            fullName: exam.fullName,
            examSlug: exam.examSlug,
            description: exam.description,
            categoryName: exam.categoryName,
          }
        : null,
    };

    return new Response(superjson.stringify(result));
  } catch (error) {
    console.error("[exams/by-slug_GET] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}