import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import superjson from "superjson";
import { schema, OutputType } from "./payment-info_GET.schema";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    if (teacherRole === "manager") {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    const setting = await db
      .selectFrom("platformSettings")
      .where("settingKey", "=", "subscription_payment_mode")
      .select("settingValue")
      .executeTakeFirst();
    
    const paymentMode = (setting?.settingValue === "recurring") ? "recurring" : "normal";

    const balanceInfo = await getTeacherAvailableBalance(effectiveTeacherId);
    
    return new Response(superjson.stringify({
      paymentMode,
      walletBalance: balanceInfo.availableBalance
    } satisfies OutputType));
  } catch(error) {
     if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 401 });
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: msg }), { status: 400 });
  }
}