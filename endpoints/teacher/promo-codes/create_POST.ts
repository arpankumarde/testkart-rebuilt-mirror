import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";
import { Selectable } from "kysely";
import { PromoCodes } from "../../../helpers/schema";

/** A refusal the teacher can act on; sent with its own message and status. */
class PromoCodeRefusal extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function verifyItemOwnership(
  teacherId: number,
  appliesTo: "courses" | "tests" | "live_tests" | "bundles" | "digital_products",
  itemIds: number[]
) {
  if (itemIds.length === 0) return;

  let ownedItems: { id: number }[];

  switch (appliesTo) {
    case "courses":
      ownedItems = await db
        .selectFrom("courses")
        .select("id")
        .where("teacherId", "=", teacherId)
        .where("id", "in", itemIds)
        .execute();
      break;
    case "tests":
      ownedItems = await db
        .selectFrom("mockTests")
        .select("id")
        .where("teacherId", "=", teacherId)
        .where("id", "in", itemIds)
        .execute();
      break;
    case "live_tests":
      ownedItems = await db
        .selectFrom("liveTests")
        .select("id")
        .where("teacherId", "=", teacherId)
        .where("id", "in", itemIds)
        .execute();
      break;
    case "bundles":
      ownedItems = await db
        .selectFrom("courseBundles")
        .select("id")
        .where("teacherId", "=", teacherId)
        .where("id", "in", itemIds)
        .execute();
      break;
    case "digital_products":
      ownedItems = await db
        .selectFrom("digitalProducts")
        .select("id")
        .where("teacherId", "=", teacherId)
        .where("id", "in", itemIds)
        .execute();
      break;
  }

  if (ownedItems.length !== itemIds.length) {
    throw new PromoCodeRefusal("Some of the items you picked are not yours. Pick them again and save.", 403);
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const data = schema.parse(json);

    // Subscription codes discount Testkart's own plans and are made by admins only.
    if (data.appliesTo === "subscription") {
      throw new PromoCodeRefusal("Promo codes for Testkart subscriptions are set by Testkart. Pick what of yours it applies to.", 400);
    }

    const existingCode = await db
      .selectFrom("promoCodes")
      .select("id")
      .where("code", "=", data.code)
      .executeTakeFirst();

    if (existingCode) {
      throw new PromoCodeRefusal(`The code ${data.code} is already taken on Testkart. Try another, for example by adding your name or a number.`, 409);
    }

    if (data.appliesTo !== "all" && data.targetItemIds && data.targetItemIds.length > 0) {
      await verifyItemOwnership(effectiveTeacherId, data.appliesTo, data.targetItemIds);
    }

    const newPromoCode = await db
      .insertInto("promoCodes")
      .values({
        ...data,
        createdByTeacherId: effectiveTeacherId,
        validFrom: data.validFrom || new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(newPromoCode satisfies Selectable<PromoCodes>), {
      status: 201,
    });
  } catch (error) {
    console.error("Failed to create promo code:", error);
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return new Response(
        superjson.stringify({ error: first ? first.message : "Check the form and try again.", details: error.issues }),
        { status: 400 }
      );
    }
    if (error instanceof PromoCodeRefusal) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to create promo code", details: errorMessage }), { status: 500 });
  }
}