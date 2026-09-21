import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./deactivate_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { productId } = schema.parse(json);

    const result = await db
      .updateTable("digitalProducts")
      .set({
        status: "archived",
        isPublished: false,
        publishedAt: null,
      })
      .where("id", "=", productId)
      .where("status", "=", "published")
      .executeTakeFirst();

    await db
      .deleteFrom("cartItems")
      .where("digitalProductId", "=", productId)
      .execute();

    if (result.numUpdatedRows === 0n) {
      const product = await db
        .selectFrom("digitalProducts")
        .select("status")
        .where("id", "=", productId)
        .executeTakeFirst();
      
      if (!product) {
        throw new Error("Digital product not found.");
      }
      if (product.status !== 'published') {
        throw new Error("Digital product is not published and cannot be deactivated.");
      }
      throw new Error("Failed to deactivate digital product.");
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Error deactivating digital product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}