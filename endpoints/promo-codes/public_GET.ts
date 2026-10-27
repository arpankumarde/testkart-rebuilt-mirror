import { schema, OutputType } from "./public_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";
import { loadPublicPromoCodes } from "../../helpers/publicPromoCodesServer";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { itemType, itemId } = schema.parse({
      itemType: url.searchParams.get("itemType"),
      itemId: url.searchParams.get("itemId"),
    });

    const promoCodes = await loadPublicPromoCodes(itemType, itemId);
    return new Response(superjson.stringify({ promoCodes } satisfies OutputType), { status: 200 });
  } catch (error) {
    console.error("Failed to list public promo codes:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input" }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "Failed to load coupons" }), { status: 500 });
  }
}