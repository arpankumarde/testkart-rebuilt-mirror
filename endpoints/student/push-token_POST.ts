import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./push-token_POST.schema";

/**
 * Stores the app's Expo push token for the signed-in user (a token moves to
 * whoever signed in on that phone last), or disables it on sign-out. The
 * autopilot pushes only to tokens that are not disabled.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    if (input.remove) {
      await db
        .updateTable("pushTokens")
        .set({ disabledAt: new Date(), disabledReason: "signed_out" })
        .where("token", "=", input.token)
        .execute();
    } else {
      await db
        .insertInto("pushTokens")
        .values({ userId: user.id, token: input.token, platform: input.platform })
        .onConflict((oc) =>
          oc.column("token").doUpdateSet({
            userId: user.id,
            platform: input.platform,
            lastSeenAt: sql`now()`,
            disabledAt: null,
            disabledReason: null,
          })
        )
        .execute();
    }
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save";
    return new Response(superjson.stringify({ error: message }), { status: /authenticat/i.test(message) ? 401 : 400 });
  }
}