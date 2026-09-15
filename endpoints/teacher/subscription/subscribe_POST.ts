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
    const { planId } = schema.parse(json);

    const plan = await db
      .selectFrom("subscriptionPlans")
      .selectAll()
      .where("id", "=", planId)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!plan) {
      throw new Error("Invalid or inactive subscription plan.");
    }

    // This route takes no payment, so it only switches to free plans. Paid
    // plans are bought through PayU or the wallet (subscription/wallet-subscribe).
    if (Number(plan.price) > 0) {
      return new Response(
        superjson.stringify({ error: "Paid plans can only be bought through checkout." }),
        { status: 400 }
      );
    }

    const output = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("teacherSubscriptions")
        .set({ status: "cancelled", updatedAt: new Date() })
        .where("teacherId", "=", effectiveTeacherId)
        .where("status", "=", "active")
        .execute();

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
          paymentMethod: null,
          autoRenew: true,
        })
        .returningAll()
        .execute();

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
