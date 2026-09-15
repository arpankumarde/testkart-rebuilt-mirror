import { schema, OutputType } from "./subscription_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    const session = await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const existing = await db
      .selectFrom("platformSettings")
      .select("id")
      .where("settingKey", "=", "subscription_payment_mode")
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable("platformSettings")
        .set({
          settingValue: input.paymentMode,
          updatedByAdminId: session.id,
          updatedAt: new Date(),
        })
        .where("id", "=", existing.id)
        .execute();
    } else {
      await db
        .insertInto("platformSettings")
        .values({
          settingKey: "subscription_payment_mode",
          settingValue: input.paymentMode,
          updatedByAdminId: session.id,
        })
        .execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Failed to update settings",
      }),
      { status: 400 }
    );
  }
}