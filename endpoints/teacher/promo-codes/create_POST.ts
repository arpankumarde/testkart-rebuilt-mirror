import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";
import { Selectable } from "kysely";
import { PromoCodes } from "../../../helpers/schema";

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
    throw new Error("You do not own all the specified items.");
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

    const existingCode = await db
      .selectFrom("promoCodes")
      .select("id")
      .where("code", "=", data.code)
      .executeTakeFirst();

    if (existingCode) {
      throw new Error("A promo code with this code already exists.");
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
      return new Response(superjson.stringify({ error: "Invalid input", details: error.issues }), { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to create promo code", details: errorMessage }), { status: 500 });
  }
}