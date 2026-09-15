import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { deleteOwnedR2Files } from "../../../helpers/r2FileOwnership";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Verify ownership and check purchases
    const product = await db
      .selectFrom("digitalProducts")
      .select(["id", "totalPurchases", "pdfFileId"])
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found or unauthorized" }),
        { status: 404 }
      );
    }

    const totalPurchases = Number(product.totalPurchases || 0);

    if (totalPurchases > 0) {
      return new Response(
        superjson.stringify({
          error: "Cannot delete a product with existing purchases. Unpublish it instead.",
        }),
        { status: 400 }
      );
    }

    // Don't trust the cached totalPurchases counter alone for something
    // irreversible — double-check the actual purchases table before wiping
    // the product and its files.
    const realPurchase = await db
      .selectFrom("digitalProductPurchases")
      .select("id")
      .where("productId", "=", input.id)
      .executeTakeFirst();

    if (realPurchase) {
      return new Response(
        superjson.stringify({
          error: "Cannot delete a product with existing purchases. Unpublish it instead.",
        }),
        { status: 400 }
      );
    }

    const files = await db
      .selectFrom("digitalProductFiles")
      .select(["fileId"])
      .where("productId", "=", input.id)
      .execute();

    // No purchases exist for this product, so it's genuinely safe to remove
    // it completely rather than leaving an archived, empty listing around
    // forever — that's what the teacher actually wants when nobody has
    // bought it yet.
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("cartItems").where("digitalProductId", "=", input.id).execute();
      await trx.deleteFrom("reviews").where("digitalProductId", "=", input.id).execute();
      await trx.deleteFrom("digitalProductFiles").where("productId", "=", input.id).execute();
      await trx.deleteFrom("digitalProducts").where("id", "=", input.id).execute();
    });

    // Best-effort R2 cleanup after the DB delete: only files this teacher
    // uploaded that no other content still uses.
    await deleteOwnedR2Files(effectiveTeacherId, [
      ...files.map((f) => f.fileId),
      product.pdfFileId,
    ]);

    console.log(`Digital product ${input.id} permanently deleted by teacher ${effectiveTeacherId}`);

    return new Response(
      superjson.stringify({ success: true, message: "Product deleted permanently" } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error deleting digital product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to delete product", details: errorMessage }),
      { status: 500 }
    );
  }
}
