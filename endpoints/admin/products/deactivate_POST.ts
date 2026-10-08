import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./deactivate_POST.schema";
import { unpublishBundlesContaining } from "../../../helpers/bundleDependencies";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { productId } = schema.parse(json);

    // The published bundles holding the product go down with it, in the same transaction.
    const result = await db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable("digitalProducts")
        .set({
          status: "archived",
          isPublished: false,
          publishedAt: null,
        })
        .where("id", "=", productId)
        .where("status", "=", "published")
        .executeTakeFirst();

      await trx
        .deleteFrom("cartItems")
        .where("digitalProductId", "=", productId)
        .execute();

      if (updated.numUpdatedRows > 0n) {
        await unpublishBundlesContaining(trx, "digital_product", [productId]);
      }
      return updated;
    });

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