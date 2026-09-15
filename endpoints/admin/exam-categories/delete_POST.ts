import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
        await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Kysely doesn't directly support ON DELETE CASCADE,
    // so we perform it in a transaction.
    await db.transaction().execute(async (trx) => {
      // Delete exams associated with the category
      await trx
        .deleteFrom("exams")
        .where("categoryId", "=", input.id)
        .execute();

      // Delete the category itself
      const result = await trx
        .deleteFrom("examCategories")
        .where("id", "=", input.id)
        .executeTakeFirst();

      if (result.numDeletedRows === 0n) {
        throw new Error("Category not found or could not be deleted.");
      }
    });

    return new Response(
      superjson.stringify({
        success: true,
        message: "Category and its exams deleted successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error(
      "[admin/exam-categories/delete_POST] Error deleting exam category:",
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