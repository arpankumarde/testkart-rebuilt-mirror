import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../helpers/db";
import { isUnsubscribeList, recordUnsubscribe, verifyUnsubscribeToken } from "../../helpers/emailUnsubscribe";
import { schema, OutputType } from "./unsubscribe_POST.schema";

/*
 * Opts a user out of one optional email list. Two callers:
 * - the /email/unsubscribe page, which posts { list, token } as superjson;
 * - mail apps using the List-Unsubscribe header (RFC 8058 one-click), which post
 *   a form body to the header URL, so list and token arrive in the query string.
 * No sign-in: the signed token is the proof.
 */

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    let list = url.searchParams.get("list");
    let token = url.searchParams.get("t");

    if (!list || !token) {
      const input = schema.parse(superjson.parse(await request.text()));
      list = input.list;
      token = input.token;
    }

    const userId = isUnsubscribeList(list) ? verifyUnsubscribeToken(token, list) : null;
    if (!userId || !isUnsubscribeList(list)) {
      return json({ error: "This unsubscribe link is not valid." }, 400);
    }

    const user = await db.selectFrom("users").select("id").where("id", "=", userId).executeTakeFirst();
    if (user) await recordUnsubscribe(db, userId, list);

    return json({ success: true } satisfies OutputType);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return json({ error: "This unsubscribe link is not valid." }, 400);
    }
    console.error("Email unsubscribe failed:", error);
    return json({ error: "Could not unsubscribe. Please try again." }, 500);
  }
}