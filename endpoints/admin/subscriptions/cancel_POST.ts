import { schema, OutputType } from "./cancel_POST.schema";
import { db } from "../../../helpers/db";
import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, [
      "super_admin",
      "admin",
      "billing_manager",
    ]);

    const body = superjson.parse(await request.text());
    const input = schema.parse(body);

    await db.transaction().execute(async (trx) => {
      // 1. Find subscription
      const sub = await trx
        .selectFrom("teacherSubscriptions")
        .where("id", "=", input.subscriptionId)
        .select(["id", "teacherId", "status", "adminNote"])
        .executeTakeFirst();

      if (!sub) {
        throw new Error("Subscription not found");
      }
      if (sub.status !== "active") {
        throw new Error("Subscription is not active");
      }

      const newAdminNote = input.reason
        ? sub.adminNote
          ? `${sub.adminNote} | Cancel Reason: ${input.reason}`
          : `Cancel Reason: ${input.reason}`
        : sub.adminNote;

      // 2. Set to cancelled
      await trx
        .updateTable("teacherSubscriptions")
        .set({
          status: "cancelled",
          autoRenew: false,
          endDate: new Date(),
          updatedAt: new Date(),
          adminNote: newAdminNote,
        })
        .where("id", "=", input.subscriptionId)
        .execute();

      // 3. Create new default Free Plan
      const freePlan = await trx
        .selectFrom("subscriptionPlans")
        .where("price", "=", "0")
        .select("id")
        .executeTakeFirst();

      if (!freePlan) {
        throw new Error("Free plan not found");
      }

      await trx
        .insertInto("teacherSubscriptions")
        .values({
          teacherId: sub.teacherId,
          planId: freePlan.id,
          status: "active",
          startDate: new Date(),
          autoRenew: false,
          paymentMethod: "free",
        })
        .execute();

      // 4. Remove teacher's verified badge
      await trx
        .updateTable("users")
        .set({ isVerified: false, updatedAt: new Date() })
        .where("id", "=", sub.teacherId)
        .execute();
    });

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 400 }
    );
  }
}