import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./update_POST.schema";
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

    // Check for uniqueness on slug change
    const existingCategory = await db
      .selectFrom("examCategories")
      .select("id")
      .where("categorySlug", "=", categorySlug)
      .where("id", "!=", input.id)
      .executeTakeFirst();

    if (existingCategory) {
      return new Response(
        superjson.stringify({ error: "A category with this slug already exists." }),
        { status: 409 }
      );
    }

    const updatedCategory = await db
      .updateTable("examCategories")
      .set({
        categoryName: input.categoryName,
        categorySlug: categorySlug,
        orderIndex: input.orderIndex,
      })
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ category: updatedCategory } satisfies OutputType)
    );
  } catch (error) {
    console.error(
      "[admin/exam-categories/update_POST] Error updating exam category:",
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