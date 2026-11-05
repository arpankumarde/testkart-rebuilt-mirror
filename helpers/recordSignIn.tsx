import { sql } from "kysely";
import { db } from "./db";
import { readVisitorContext } from "./readVisitorContext";
import { recordFunnelEvent } from "./recordFunnelEvent";

/**
 * Call once a sign-up or sign-in has succeeded and the session is set. It ties
 * the browser's visitor id to the account (identity_links), gives that
 * visitor's earlier anonymous events the user id, and records the signup or
 * login event. Best effort and never throws. Uses the global db, so call it
 * outside any transaction, and await it.
 */
export async function recordSignIn(
  request: Request,
  userId: number,
  kind: "signup" | "login",
  method: string
): Promise<void> {
  const { visitorId } = readVisitorContext(request);
  if (visitorId) {
    try {
      await db
        .insertInto("identityLinks")
        .values({ visitorId, userId, method })
        .onConflict((oc) => oc.columns(["visitorId", "userId"]).doUpdateSet({ lastLinkedAt: sql`now()`, method }))
        .execute();
      await db
        .updateTable("funnelEvents")
        .set({ userId })
        .where("visitorId", "=", visitorId)
        .where("userId", "is", null)
        .where("occurredAt", ">", sql<Date>`now() - interval '90 days'`)
        .execute();
    } catch (error) {
      console.error("Could not link the visitor to the signed-in user:", error);
    }
  }
  await recordFunnelEvent({ event: kind, request, userId, props: { method } });
}