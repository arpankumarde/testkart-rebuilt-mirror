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

    const categorySlug = input.categorySlug
      ? slugify(input.categorySlug)
      : slugify(input.categoryName);

    // Check for uniqueness
    const existingCategory = await db
      .selectFrom("examCategories")
      .select("id")
      .where("categorySlug", "=", categorySlug)
      .executeTakeFirst();

    if (existingCategory) {
      return new Response(
        superjson.stringify({ error: "A category with this slug already exists." }),
        { status: 409 }
      );
    }

    const newCategory = await db
      .insertInto("examCategories")
      .values({
        categoryName: input.categoryName,
        categorySlug: categorySlug,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ category: newCategory } satisfies OutputType)
    );
  } catch (error) {
    console.error(
      "[admin/exam-categories/create_POST] Error creating exam category:",
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}