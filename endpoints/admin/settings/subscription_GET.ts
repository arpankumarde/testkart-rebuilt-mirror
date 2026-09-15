import { OutputType } from "./subscription_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    
    const setting = await db
      .selectFrom("platformSettings")
      .select("settingValue")
      .where("settingKey", "=", "subscription_payment_mode")
      .executeTakeFirst();

    const paymentMode = setting?.settingValue === "recurring" ? "recurring" : "normal";

    return new Response(
      superjson.stringify({ paymentMode } satisfies OutputType)
    );
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch settings",
      }),
      { status: 400 }
    );
  }
}