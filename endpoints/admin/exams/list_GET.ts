import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
        await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const categoryId = url.searchParams.get("categoryId");
    const parsedInput = schema.parse({
      categoryId: categoryId ? Number(categoryId) : undefined,
    });

    let query = db
      .selectFrom("exams")
      .innerJoin("examCategories", "exams.categoryId", "examCategories.id")
      .select([
        "exams.id",
        "exams.categoryId",
        "exams.examName",
        "exams.fullName",
        "exams.examSlug",
        "exams.description",
        "exams.orderIndex",
        "exams.aiGenerationPrompt",
        "exams.ownerTag",
        "exams.contentDueDate",
        "exams.createdAt",
        "exams.updatedAt",
        "examCategories.categoryName",
      ])
      .orderBy("examCategories.categoryName", "asc")
      .orderBy("exams.orderIndex", "asc");

    if (parsedInput.categoryId) {
      query = query.where("exams.categoryId", "=", parsedInput.categoryId);
    }

    const exams = await query.execute();

    return new Response(superjson.stringify({ exams } satisfies OutputType));
  } catch (error) {
    console.error("[admin/exams/list_GET] Error fetching exams:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}