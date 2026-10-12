import { db } from "../../helpers/db";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const categories = await db
      .selectFrom("examCategories")
      .select(["id", "categoryName"])
      .orderBy("orderIndex", "asc")
      .orderBy("categoryName", "asc")
      .execute();

    const exams = await db
      .selectFrom("exams")
      .select(["id", "categoryId", "examName", "fullName", "examSlug"])
      .orderBy("orderIndex", "asc")
      .orderBy("examName", "asc")
      .execute();

    const categoriesWithExams = categories.map((category) => ({
      id: category.id,
      categoryName: category.categoryName,
      exams: exams
        .filter((exam) => exam.categoryId === category.id)
        .map(({ id, examName, fullName, examSlug }) => ({
          id,
          examName,
          fullName,
          examSlug,
        })),
    }));

    return new Response(
      superjson.stringify({
        categories: categoriesWithExams,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[exams/list_GET] Error fetching exams list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}