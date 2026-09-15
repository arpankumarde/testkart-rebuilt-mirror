import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./remove_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const json = superjson.parse(await request.text());
    const { cartItemId } = schema.parse(json);

    const result = await db
      .deleteFrom("cartItems")
      .where("id", "=", cartItemId)
      .where("userId", "=", user.id) // Ensure user can only delete their own items
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      return new Response(
        superjson.stringify({ error: "Cart item not found or you do not have permission to remove it." }),
        { status: 404 }
      );
    }

    return new Response(
      superjson.stringify({
        message: "Item removed from cart successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to remove item from cart:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to remove item from cart.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}