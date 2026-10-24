import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { TCOINS_SETTING_KEY } from "../../../helpers/tcoins";
import { schema, OutputType } from "./tcoins_POST.schema";

export async function handle(request: Request) {
  try {
    const session = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const settingValue = JSON.stringify(input);

    const existing = await db
      .selectFrom("platformSettings")
      .select("id")
      .where("settingKey", "=", TCOINS_SETTING_KEY)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable("platformSettings")
        .set({ settingValue, updatedByAdminId: session.id, updatedAt: new Date() })
        .where("id", "=", existing.id)
        .execute();
    } else {
      await db
        .insertInto("platformSettings")
        .values({ settingKey: TCOINS_SETTING_KEY, settingValue, updatedByAdminId: session.id })
        .execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Failed to update Tcoins settings",
      }),
      { status: 400 }
    );
  }
}