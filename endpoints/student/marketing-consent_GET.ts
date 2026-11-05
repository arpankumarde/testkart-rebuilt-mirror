import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType } from "./marketing-consent_GET.schema";

/** The signed-in student's WhatsApp marketing choice (marketing_consents). */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const row = await db
      .selectFrom("marketingConsents")
      .select("granted")
      .where("userId", "=", user.id)
      .where("channel", "=", "whatsapp")
      .executeTakeFirst();
    const output: OutputType = { whatsapp: row ? (row.granted ? "granted" : "declined") : null };
    return new Response(superjson.stringify(output));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load";
    return new Response(superjson.stringify({ error: message }), { status: /authenticat/i.test(message) ? 401 : 500 });
  }
}