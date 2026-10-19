import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./toggle_POST.schema";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    await db
      .updateTable("promoCodes")
      .set({ isActive: input.isActive, updatedAt: new Date() })
      .where("id", "=", input.promoCodeId)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to update promo code" }),
      { status: 400 }
    );
  }
}
