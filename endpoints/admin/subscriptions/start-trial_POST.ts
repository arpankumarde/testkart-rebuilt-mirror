import { schema, OutputType } from "./start-trial_POST.schema";
import { db } from "../../../helpers/db";
import superjson from "superjson";
import { Expression, SqlBool } from "kysely";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);
    
    const body = superjson.parse(await request.text());
    const input = schema.parse(body);
    
    const result = await db.transaction().execute(async (trx) => {
      // 1. Verify teacher exists
      const teacher = await trx.selectFrom("users")
        .where("id", "=", input.teacherId)
        .where("role", "=", "teacher")
        .select("id")
        .executeTakeFirst();
        
      if (!teacher) {
        throw new Error("Teacher not found");
      }
      
      // 1.5. Verify teacher doesn't have an active paid subscription
      const activePaidSubscription = await trx.selectFrom("teacherSubscriptions")
        .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
        .select(["subscriptionPlans.name as planName"])
        .where("teacherSubscriptions.teacherId", "=", input.teacherId)
        .where("teacherSubscriptions.status", "=", "active")
        .where("teacherSubscriptions.endDate", ">", new Date())
        .where("subscriptionPlans.price", ">", "0")
        .executeTakeFirst();
        
      if (activePaidSubscription) {
        throw new Error(`This teacher has an active paid subscription (${activePaidSubscription.planName}). Custom commission trials can only be started for teachers on the Free Plan.`);
      }
      
      // 2. Expire current active subscriptions
      await trx.updateTable("teacherSubscriptions")
        .set({ status: "expired", updatedAt: new Date() })
        .where("teacherId", "=", input.teacherId)
        .where("status", "=", "active")
        .execute();
        
      // 3. Get free plan
      const freePlan = await trx.selectFrom("subscriptionPlans")
        .where("price", "=", "0")
        .select("id")
        .executeTakeFirst();
        
      if (!freePlan) {
        throw new Error("Free plan not found");
      }
      
      // 4. Insert new trial subscription
      const now = new Date();
      const endDate = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000);
      
      const insertResult = await trx.insertInto("teacherSubscriptions")
        .values({
          teacherId: input.teacherId,
          planId: freePlan.id,
          status: "active",
          startDate: now,
          endDate: endDate,
          autoRenew: false,
          paymentMethod: "admin_trial",
          platformFeeOverride: input.platformFeePercentage,
          adminNote: input.note || null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
        
      // 5. Retroactive updates for past order items
      let cutoffDate: Date | null = null;
      if (input.retroactiveFromOrderItemId != null) {
        const cutoffOrderItem = await trx.selectFrom("orderItems")
          .innerJoin("orders", "orders.id", "orderItems.orderId")
          .select("orders.createdAt")
          .where("orderItems.id", "=", input.retroactiveFromOrderItemId)
          .executeTakeFirst();

        if (!cutoffOrderItem) {
          throw new Error("Order item not found");
        }

        cutoffDate = cutoffOrderItem.createdAt;
      } else if (input.retroactiveFromDate != null) {
        cutoffDate = new Date(input.retroactiveFromDate);
        if (isNaN(cutoffDate.getTime())) {
          throw new Error("Invalid retroactiveFromDate format");
        }
      }

      if (cutoffDate != null) {
        // Find teacher's items
        const [courses, digitalProducts, mockTests] = await Promise.all([
          trx.selectFrom("courses").select("id").where("teacherId", "=", input.teacherId).execute(),
          trx.selectFrom("digitalProducts").select("id").where("teacherId", "=", input.teacherId).execute(),
          trx.selectFrom("mockTests").select("id").where("teacherId", "=", input.teacherId).execute(),
        ]);

        const courseIds = courses.map(c => c.id);
        const dpIds = digitalProducts.map(dp => dp.id);
        const mtIds = mockTests.map(mt => mt.id);

        if (courseIds.length > 0 || dpIds.length > 0 || mtIds.length > 0) {
          let query = trx.selectFrom("orderItems")
            .innerJoin("orders", "orders.id", "orderItems.orderId")
            .select("orderItems.id")
            .where("orders.status", "=", "completed")
            .where("orders.createdAt", ">=", cutoffDate);
            
          query = query.where((eb) => {
            const orConditions: Expression<SqlBool>[] = [];
            if (courseIds.length > 0) orConditions.push(eb("orderItems.courseId", "in", courseIds));
            if (dpIds.length > 0) orConditions.push(eb("orderItems.digitalProductId", "in", dpIds));
            if (mtIds.length > 0) orConditions.push(eb("orderItems.mockTestId", "in", mtIds));
            return eb.or(orConditions);
          });

          const matchingItems = await query.execute();
          const orderItemIds = matchingItems.map(item => item.id);

          if (orderItemIds.length > 0) {
            // Chunk update to prevent huge queries
            const chunkSize = 1000;
            for (let i = 0; i < orderItemIds.length; i += chunkSize) {
              const chunk = orderItemIds.slice(i, i + chunkSize);
              await trx.updateTable("orderItems")
                .set({ platformFeePercentage: input.platformFeePercentage })
                .where("id", "in", chunk)
                .execute();
            }
          }
        }
      }
      
      return insertResult.id;
    });

    return new Response(superjson.stringify({ success: true, subscriptionId: result } satisfies OutputType));
  } catch (error) {
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }), { status: 400 });
  }
}