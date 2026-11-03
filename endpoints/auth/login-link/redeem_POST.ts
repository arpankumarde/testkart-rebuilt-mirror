import { randomBytes } from "crypto";
import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { setServerSession, SessionExpirationSeconds } from "../../../helpers/getSetServerSession";
import { getAccountBlockMessage } from "../../../helpers/accountSuspension";
import { hashLoginLinkToken, LOGIN_LINK_TOKEN_PATTERN } from "../../../helpers/loginLinkToken";
import { schema, OutputType } from "./redeem_POST.schema";

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const UNUSABLE = "This sign-in link has expired, was already used or was cancelled. Ask Testkart support for a new one.";

class BlockedAccountError extends Error {}

/*
 * Signs the browser in with an admin-made sign-in link (admin_login_links). The link is claimed
 * and the session created in one transaction, so a single-use link cannot be used twice and a
 * suspended or banned account does not use the link up. The session is an ordinary one, the
 * same as an OTP sign-in.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { token } = schema.parse(superjson.parse(await request.text()));
    if (!LOGIN_LINK_TOKEN_PATTERN.test(token)) return json({ error: UNUSABLE }, 400);

    const now = new Date();
    const sessionId = randomBytes(32).toString("hex");

    const userId = await db.transaction().execute(async (trx) => {
      const claimed = await trx
        .updateTable("adminLoginLinks")
        .set({ useCount: sql`use_count + 1`, lastUsedAt: now })
        .where("tokenHash", "=", hashLoginLinkToken(token))
        .where("revokedAt", "is", null)
        .where("expiresAt", ">", now)
        .where((eb) => eb.or([eb("singleUse", "=", false), eb("useCount", "=", 0)]))
        .where("userId", "in", (eb) => eb.selectFrom("users").select("id").where("role", "!=", "admin"))
        .returning(["id", "userId"])
        .executeTakeFirst();
      if (!claimed) return null;

      const blockedMessage = await getAccountBlockMessage(claimed.userId, trx);
      if (blockedMessage) throw new BlockedAccountError(blockedMessage);

      await trx
        .insertInto("sessions")
        .values({
          id: sessionId,
          userId: claimed.userId,
          createdAt: now,
          lastAccessed: now,
          expiresAt: new Date(now.getTime() + SessionExpirationSeconds * 1000),
        })
        .execute();

      console.log(`Sign-in link ${claimed.id} used for user ${claimed.userId}`);
      return claimed.userId;
    });

    if (userId === null) return json({ error: UNUSABLE }, 400);

    const response = json({ success: true } satisfies OutputType);
    await setServerSession(response, {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
    });
    return response;
  } catch (error) {
    if (error instanceof BlockedAccountError) return json({ error: error.message }, 403);
    console.error("Error using sign-in link:", error);
    return json({ error: "Could not sign you in. Try again." }, 500);
  }
}