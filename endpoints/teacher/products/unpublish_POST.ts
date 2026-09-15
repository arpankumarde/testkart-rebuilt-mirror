import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./unpublish_POST.schema";
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
      .select("id")
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found or unauthorized" }),
        { status: 404 }
      );
    }

    const updatedProduct = await db
      .updateTable("digitalProducts")
      .set({
        status: "draft",
        isPublished: false,
        updatedAt: new Date(),
      })
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Remove this product from all carts since it's no longer published
    await db
      .deleteFrom("cartItems")
      .where("digitalProductId", "=", input.id)
      .execute();

    console.log(`Deleted cart items referencing digital product ${input.id} after unpublishing.`);

    const output: OutputType = {
      ...updatedProduct,
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