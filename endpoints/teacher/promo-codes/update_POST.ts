import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";
import { Selectable } from "kysely";
import { PromoCodes } from "../../../helpers/schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { promoCodeId, ...updates } = schema.parse(json);

    const promoCode = await db
      .selectFrom("promoCodes")
      .select(["id", "createdByTeacherId"])
      .where("id", "=", promoCodeId)
      .executeTakeFirst();

    if (!promoCode) {
      return new Response(superjson.stringify({ error: "Promo code not found" }), { status: 404 });
    }

    if (promoCode.createdByTeacherId !== effectiveTeacherId) {
      return new Response(superjson.stringify({ error: "You do not own this promo code" }), { status: 403 });
    }

    const updatedPromoCode = await db
      .updateTable("promoCodes")
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where("id", "=", promoCodeId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(updatedPromoCode satisfies Selectable<PromoCodes>), {
      status: 200,
    });
  } catch (error) {
    console.error("Failed to update promo code:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input", details: error.issues }), { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to update promo code", details: errorMessage }), { status: 500 });
  }
}