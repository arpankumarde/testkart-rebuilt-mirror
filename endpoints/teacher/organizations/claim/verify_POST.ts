import { sql } from "kysely";
import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { CLAIM_MAX_VERIFY_ATTEMPTS } from "../../../../helpers/organizationClaim";
import { schema, OutputType } from "./verify_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teacher accounts can claim an organisation." }), {
        status: 403,
      });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Claim one attempt against the latest pending, unexpired request for
    // this org + teacher pairing in a single UPDATE, so concurrent guesses
    // can't all read the same stale attempt count.
    const claimed = await db
      .updateTable("organizationClaimRequests")
      .set({ attempts: sql`${sql.ref("attempts")} + 1` })
      .where("id", "=", (eb) =>
        eb
          .selectFrom("organizationClaimRequests")
          .select("id")
          .where("organizationId", "=", input.organizationId)
          .where("teacherId", "=", effectiveTeacherId)
          .where("status", "=", "pending")
          .where("expiresAt", ">", new Date())
          .orderBy("createdAt", "desc")
          .limit(1)
      )
      .where("attempts", "<", CLAIM_MAX_VERIFY_ATTEMPTS)
      .returning(["id", "otpCode", "attempts"])
      .executeTakeFirst();

    if (!claimed) {
      return new Response(
        superjson.stringify({ error: "No active verification code found, or too many incorrect attempts. Please request a new code." }),
        { status: 400 }
      );
    }

    if (claimed.otpCode !== input.code.trim()) {
      return new Response(superjson.stringify({ error: "Incorrect code. Please try again." }), { status: 400 });
    }

    const org = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("organizationClaimRequests")
        .set({ status: "verified", verifiedAt: new Date() })
        .where("id", "=", claimed.id)
        .execute();

      // Guard against a double-claim race: only succeeds if the org hasn't
      // already been claimed by someone else between start() and now.
      const updatedOrg = await trx
        .updateTable("organizations")
        .set({ createdByTeacherId: effectiveTeacherId, claimStatus: "claimed", updatedAt: new Date() })
        .where("id", "=", input.organizationId)
        .where("claimStatus", "!=", "claimed")
        .returning(["id", "slug"])
        .executeTakeFirst();

      if (!updatedOrg) {
        throw new Error("This organisation was already claimed by someone else.");
      }

      await trx
        .insertInto("organizationTeachers")
        .values({
          organizationId: updatedOrg.id,
          teacherId: effectiveTeacherId,
          status: "approved",
          respondedAt: new Date(),
          respondedByTeacherId: effectiveTeacherId,
        })
        .onConflict((oc) => oc.columns(["organizationId", "teacherId"]).doNothing())
        .execute();

      return updatedOrg;
    });

    return new Response(
      superjson.stringify({ success: true, organizationSlug: org.slug } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to verify organisation claim:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 409 });
  }
}