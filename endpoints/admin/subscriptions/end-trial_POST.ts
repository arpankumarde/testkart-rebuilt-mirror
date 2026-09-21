import { schema, OutputType } from "./end-trial_POST.schema";
import { db } from "../../../helpers/db";
import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    
    const body = superjson.parse(await request.text());
    const input = schema.parse(body);
    
    await db.transaction().execute(async (trx) => {
      // 1. Find subscription
      const sub = await trx.selectFrom("teacherSubscriptions")
        .where("id", "=", input.subscriptionId)
        .select(["id", "teacherId", "paymentMethod", "status"])
        .executeTakeFirst();
        
      if (!sub) {
        throw new Error("Subscription not found");
      }
      if (sub.paymentMethod !== "admin_trial" || sub.status !== "active") {
        throw new Error("Subscription is not an active admin trial");
      }
      
      // 2. Set to expired
      await trx.updateTable("teacherSubscriptions")
        .set({ status: "expired", endDate: new Date(), updatedAt: new Date() })
        .where("id", "=", input.subscriptionId)
        .execute();
        
      // 3. Create new default Free Plan
      const freePlan = await trx.selectFrom("subscriptionPlans")
        .where("price", "=", "0")
        .select("id")
        .executeTakeFirst();
        
      if (!freePlan) {
        throw new Error("Free plan not found");
      }
      
      await trx.insertInto("teacherSubscriptions")
        .values({
          teacherId: sub.teacherId,
          planId: freePlan.id,
          status: "active",
          startDate: new Date(),
          autoRenew: false,
          paymentMethod: "free",
        })
        .execute();
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }), { status: 400 });
  }
}