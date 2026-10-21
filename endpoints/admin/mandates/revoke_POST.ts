import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { revokeSubscriptionMandate } from "../../../helpers/teacherMandate";
import { schema, OutputType } from "./revoke_POST.schema";
import superjson from "superjson";

/**
 * Stops autopay on a mandate without touching the subscription's plan or end
 * date (the plan just won't renew). This is the PayU-merchant-API equivalent
 * of "pause": PayU exposes a revoke command but no merchant-initiated pause,
 * so a UPI payer can pause their own mandate from their bank app (we observe
 * that as mandateStatus "paused"), but we can only ever revoke it outright.
 */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const { subscriptionId, reason } = schema.parse(superjson.parse(await request.text()));

    const sub = await db
      .selectFrom("teacherSubscriptions")
      .select(["id", "mandateId", "adminNote"])
      .where("id", "=", subscriptionId)
      .executeTakeFirst();
    if (!sub) {
      throw new Error("Subscription not found.");
    }
    if (!sub.mandateId) {
      throw new Error("This subscription has no mandate to revoke.");
    }

    const mandateStatus = await revokeSubscriptionMandate(subscriptionId);
    if (!mandateStatus) {
      throw new Error("No live mandate was found to revoke (it may already be cancelled).");
    }

    if (reason) {
      const newNote = sub.adminNote ? `${sub.adminNote} | Mandate revoked: ${reason}` : `Mandate revoked: ${reason}`;
      await db
        .updateTable("teacherSubscriptions")
        .set({ adminNote: newNote, updatedAt: new Date() })
        .where("id", "=", subscriptionId)
        .execute();
    }

    return new Response(superjson.stringify({ success: true, mandateStatus } satisfies OutputType));
  } catch (error) {
    console.error("[admin/mandates/revoke] Failed:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to revoke mandate." }),
      { status: 400 }
    );
  }
}
