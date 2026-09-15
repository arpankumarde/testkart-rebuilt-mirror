import { schema, OutputType } from "./toggle_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const existing = await db
      .selectFrom("subscriptionPlans")
      .select("price")
      .where("id", "=", input.planId)
      .executeTakeFirst();

    if (!existing) {
      throw new Error("Plan not found");
    }

    if (parseFloat(existing.price as string) === 0 && !input.isActive) {
      throw new Error("Cannot deactivate the Free Plan.");
    }

    await db
      .updateTable("subscriptionPlans")
      .set({ isActive: input.isActive })
      .where("id", "=", input.planId)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Failed to toggle plan status",
      }),
      { status: 400 }
    );
  }
}