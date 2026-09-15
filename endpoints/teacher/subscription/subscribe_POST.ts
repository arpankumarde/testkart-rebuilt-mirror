import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./subscribe_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { planId, paymentMethod } = schema.parse(json);

    const output = await db.transaction().execute(async (trx) => {
      const existingSubscription = await trx
        .selectFrom("teacherSubscriptions")
        .where("teacherId", "=", effectiveTeacherId)
        .where("status", "=", "active")
        .select("id")
        .executeTakeFirst();

      // If teacher has an active subscription, cancel it to allow plan switching
      if (existingSubscription) {
        await trx
          .updateTable("teacherSubscriptions")
          .set({ status: "cancelled", updatedAt: new Date() })
          .where("id", "=", existingSubscription.id)
          .execute();
      }

      const plan = await trx
        .selectFrom("subscriptionPlans")
        .selectAll()
        .where("id", "=", planId)
        .where("isActive", "=", true)
        .executeTakeFirst();

      if (!plan) {
        throw new Error("Invalid or inactive subscription plan.");
      }

      // Check if plan is free
      const isFree = Number(plan.price) === 0;

      // Validate payment method for paid plans
      if (!isFree && !paymentMethod) {
        throw new Error("Payment method is required for paid plans.");
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + plan.durationDays);

      const [newSubscription] = await trx
        .insertInto("teacherSubscriptions")
        .values({
          teacherId: effectiveTeacherId,
          planId: plan.id,
          status: "active",
          startDate,
          endDate,
          paymentMethod: isFree ? null : paymentMethod,
          autoRenew: true,
        })
        .returningAll()
        .execute();

      // Only create transaction for paid plans
      if (!isFree) {
        await trx
          .insertInto("subscriptionTransactions")
          .values({
            teacherId: effectiveTeacherId,
            planId: plan.id,
            subscriptionId: newSubscription.id,
            amount: plan.price,
            status: "completed",
            paymentMethod: paymentMethod!,
            transactionId: `SIM_${Date.now()}`, // Simulated transaction ID
          })
          .execute();

        // Auto-verify teacher on paid subscription
        await trx
          .updateTable("users")
          .set({ isVerified: true })
          .where("id", "=", effectiveTeacherId)
          .execute();
      }

      return newSubscription;
    });

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    console.error("Error subscribing to plan:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 401,
      });
    }
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