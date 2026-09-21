import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { slugify } from "../../../helpers/slugify";

export async function handle(request: Request): Promise<Response> {
  try {
        await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const examSlug = input.examSlug
      ? slugify(input.examSlug)
      : slugify(input.examName);

    // Check for uniqueness within the same category
    const existingExam = await db
      .selectFrom("exams")
      .select("id")
      .where("examSlug", "=", examSlug)
      .where("categoryId", "=", input.categoryId)
      .executeTakeFirst();

    if (existingExam) {
      return new Response(
        superjson.stringify({
          error: "An exam with this slug already exists in this category.",
        }),
        { status: 409 }
      );
    }

    const newExam = await db
      .insertInto("exams")
      .values({
        categoryId: input.categoryId,
        examName: input.examName,
        fullName: input.fullName,
        examSlug: examSlug,
        description: input.description,
        orderIndex: input.orderIndex,
        aiGenerationPrompt: input.aiGenerationPrompt,
        ownerTag: input.ownerTag ?? null,
        contentDueDate: input.contentDueDate ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify({ exam: newExam } satisfies OutputType));
  } catch (error) {
    console.error("[admin/exams/create_POST] Error creating exam:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}