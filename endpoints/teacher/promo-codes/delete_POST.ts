import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { promoCodeId } = schema.parse(json);

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

    await db
      .updateTable("promoCodes")
      .set({ isActive: false, updatedAt: new Date() })
      .where("id", "=", promoCodeId)
      .execute();

    return new Response(
      superjson.stringify({
        success: true,
        message: "Promo code has been deactivated.",
      } satisfies OutputType),
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete promo code:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input", details: error.issues }), { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to delete promo code", details: errorMessage }), { status: 500 });
  }
}