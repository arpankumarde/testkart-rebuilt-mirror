import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./reorder_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB } from "../../../helpers/schema";

async function reorderItems(
  items: { itemId: number; orderIndex: number }[],
  trx: Transaction<DB>
) {
  const updatePromises = items.map((item) =>
    trx
      .updateTable("mockTestItems")
      .set({ orderIndex: item.orderIndex })
      .where("id", "=", item.itemId)
      .execute()
  );
  await Promise.all(updatePromises);
}

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

    if (input.items.length === 0) {
      return new Response(
        superjson.stringify({
          success: true,
          message: "No items to reorder.",
        } satisfies OutputType)
      );
    }

    const itemIds = input.items.map((item) => item.itemId);

    await db.transaction().execute(async (trx) => {
      const dbItems = await trx
        .selectFrom("mockTestItems")
        .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
        .select(["mockTestItems.id", "mockTests.teacherId", "mockTests.id as packageId"])
        .where("mockTestItems.id", "in", itemIds)
        .execute();

      if (dbItems.length !== itemIds.length) {
        throw new Error("One or more test items not found.");
      }

      if (dbItems.length > 0) {
        const firstItem = dbItems[0];
        const ownerId = firstItem.teacherId;
        const packageId = firstItem.packageId;

        if (ownerId !== effectiveTeacherId) {
          throw new Error("You do not have permission to reorder these items.");
        }

        for (const item of dbItems) {
          if (item.packageId !== packageId) {
            throw new Error("All items must belong to the same test package.");
          }
        }
      }

      await reorderItems(input.items, trx);
    });

    return new Response(
      superjson.stringify({
        success: true,
        message: "Test items reordered successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error reordering test items:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}