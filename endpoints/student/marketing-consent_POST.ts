import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { isStudentAccount, STUDENT_ACCOUNT_REQUIRED } from "../../helpers/studentAccountRequired";
import { schema, OutputType } from "./marketing-consent_POST.schema";

const NOTICE_VERSION = "2026-11-14";

/**
 * Records the student's own yes or no to WhatsApp reminders and offers. No page
 * calls it since the dialog step was removed on 15-11-2026 (consent is taken
 * outside the product and every student is recorded as granted). A STOP reply
 * (webhooks/waplify) still turns it to declined. Saying yes also clears an
 * earlier STOP opt-out, since the student chose again.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (!isStudentAccount(user)) {
      return new Response(superjson.stringify({ error: STUDENT_ACCOUNT_REQUIRED }), { status: 403 });
    }
    const input = schema.parse(superjson.parse(await request.text()));
    await db
      .insertInto("marketingConsents")
      .values({ userId: user.id, channel: "whatsapp", granted: input.granted, source: input.source, noticeVersion: NOTICE_VERSION })
      .onConflict((oc) =>
        oc.columns(["userId", "channel"]).doUpdateSet({
          granted: input.granted,
          source: input.source,
          noticeVersion: NOTICE_VERSION,
          decidedAt: sql`now()`,
        })
      )
      .execute();
    if (input.granted) {
      await db.deleteFrom("emailUnsubscribes").where("userId", "=", user.id).where("list", "=", "whatsapp_marketing").execute();
    }
    return new Response(superjson.stringify({ whatsapp: input.granted ? "granted" : "declined" } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save";
    return new Response(superjson.stringify({ error: message }), { status: /authenticat/i.test(message) ? 401 : 400 });
  }
}