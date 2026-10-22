import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./unpublish_POST.schema";
import {
  bundleConfirmationResponse,
  findPublishedBundlesContaining,
  unpublishBundles,
} from "../../../helpers/bundleDependencies";
import { clearOpenReviews } from "../../../helpers/contentReviewQueue";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const product = await db
      .selectFrom("digitalProducts")
      .select(["id", "status"])
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found or unauthorized" }),
        { status: 404 }
      );
    }

    // One transaction, so the product, its cart rows and the bundles holding it
    // change together or not at all. A product that is not live is not holding
    // any bundle up, so only a published one triggers the bundle check.
    const result = await db.transaction().execute(async (trx) => {
      const bundles =
        product.status === "published"
          ? await findPublishedBundlesContaining(trx, "digital_product", [input.id])
          : [];
      if (bundles.length > 0 && !input.confirmBundleUnpublish) {
        return { kind: "needs-confirmation" as const, bundles };
      }

      const now = new Date();
      // A live unlisted item's request to go public ends with it.
      if (product.status === "published") await clearOpenReviews(trx, "digital_product", input.id);
      const updatedProduct = await trx
        .updateTable("digitalProducts")
        .set({
          status: "draft",
          isPublished: false,
          updatedAt: now,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // Remove this product from all carts since it's no longer published
      await trx
        .deleteFrom("cartItems")
        .where("digitalProductId", "=", input.id)
        .execute();

      await unpublishBundles(trx, bundles, now);
      return { kind: "done" as const, updatedProduct, bundles };
    });

    if (result.kind === "needs-confirmation") {
      return bundleConfirmationResponse(result.bundles);
    }

    const { updatedProduct } = result;
    console.log(`Deleted cart items referencing digital product ${input.id} after unpublishing.`);

    const output: OutputType = {
      ...updatedProduct,
      unpublishedBundles: result.bundles,
      price: Number(updatedProduct.price),
      rating: updatedProduct.rating ? Number(updatedProduct.rating) : null,
      fileSizeBytes: updatedProduct.fileSizeBytes ? Number(updatedProduct.fileSizeBytes) : null,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error unpublishing digital product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to unpublish product", details: errorMessage }),
      { status: 500 }
    );
  }
}