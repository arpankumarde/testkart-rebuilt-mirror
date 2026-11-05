import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { readVisitorContext } from "../../helpers/readVisitorContext";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";
import { schema } from "./event_POST.schema";

const MAX_EVENTS_PER_TEN_MINUTES = 60;

// A tiny 200 rather than a 204: the Floot preview's fetch wrapper throws on an empty-body status.
const accepted = () => new Response(superjson.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });

/**
 * Public: records one browser-only funnel event (an add-to-cart click before
 * the login wall, the login wall itself, an offer shown). The visitor id and
 * traffic source come from the tk_vid and tk_touch cookies, never the body.
 * Admins are not counted, and each visitor is capped per ten minutes.
 */
export async function handle(request: Request): Promise<Response> {
  let input;
  try {
    input = schema.parse(superjson.parse(await request.text()));
  } catch {
    return new Response(superjson.stringify({ error: "Invalid event" }), { status: 400 });
  }

  try {
    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      if (user.role === "admin") return accepted();
      userId = user.id;
    } catch {
      // Signed out: an anonymous visitor.
    }

    const { visitorId } = readVisitorContext(request);
    if (!visitorId && userId === null) return accepted();

    const recent = await db
      .selectFrom("funnelEvents")
      .select(sql<number>`count(*)::int`.as("n"))
      .where(visitorId ? "visitorId" : "userId", "=", visitorId ?? userId)
      .where("occurredAt", ">", sql<Date>`now() - interval '10 minutes'`)
      .executeTakeFirst();
    if ((recent?.n ?? 0) >= MAX_EVENTS_PER_TEN_MINUTES) return accepted();

    await recordFunnelEvent({
      event: input.event,
      request,
      userId,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      props: { ...(input.props ?? {}), ...(input.path ? { path: input.path } : {}) },
    });
    return accepted();
  } catch (error) {
    console.error("Error recording funnel event:", error);
    return new Response(superjson.stringify({ error: "Could not record event" }), { status: 500 });
  }
}