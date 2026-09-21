import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, StorefrontEntity } from "./track_POST.schema";

type Row = Record<string, unknown>;

const SHARE_SOURCES: Record<string, string> = {
  whatsapp: "share_whatsapp",
  facebook: "share_facebook",
  x: "share_x",
  telegram: "share_telegram",
  linkedin: "share_linkedin",
  email: "share_email",
  copy_link: "share_copy",
};

const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z.]+|ecosia\.org)$/;
const SOCIAL_HOSTS =
  /(^|\.)(facebook\.com|fb\.com|instagram\.com|t\.co|x\.com|twitter\.com|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|t\.me|telegram\.org|whatsapp\.com|reddit\.com|quora\.com|threads\.net)$/;
const OWN_HOSTS = /(^|\.)(testkart\.in|floot\.app)$/;

/**
 * Where a visit came from, decided here rather than trusted from the client:
 * a Testkart share link (share_<platform>), another tagged link (campaign),
 * search, social, Testkart itself, another site, or no referrer at all.
 */
function classifySource(utmSource: string | null, referrerHost: string | null): string {
  if (utmSource) return SHARE_SOURCES[utmSource] ?? "campaign";
  if (!referrerHost) return "direct";
  if (OWN_HOSTS.test(referrerHost)) return "internal";
  if (SEARCH_HOSTS.test(referrerHost)) return "search";
  if (SOCIAL_HOSTS.test(referrerHost)) return "social";
  return "referral";
}

/** The owning teacher of a published, on-sale item, or null. */
async function resolveEntity(
  entity: StorefrontEntity,
  id: number | undefined,
  slug: string | undefined
): Promise<{ entityId: number; teacherId: number } | null> {
  const byKey = (idColumn: string, slugColumn: string | null) =>
    id !== undefined ? sql`${sql.ref(idColumn)} = ${id}` : slugColumn ? sql`${sql.ref(slugColumn)} = ${slug}` : sql`false`;

  let query;
  switch (entity) {
    case "mock_test":
      query = sql<Row>`SELECT id, teacher_id FROM mock_tests
        WHERE ${byKey("mock_tests.id", "mock_tests.slug")} AND is_published = true AND deleted_at IS NULL LIMIT 1`;
      break;
    case "live_test":
      query = sql<Row>`SELECT id, teacher_id FROM live_tests
        WHERE ${byKey("live_tests.id", null)} AND is_active = true LIMIT 1`;
      break;
    case "course":
      query = sql<Row>`SELECT id, teacher_id FROM courses
        WHERE ${byKey("courses.id", "courses.slug")} AND status = 'published' LIMIT 1`;
      break;
    case "digital_product":
      query = sql<Row>`SELECT id, teacher_id FROM digital_products
        WHERE ${byKey("digital_products.id", "digital_products.slug")} AND status = 'published' LIMIT 1`;
      break;
    case "bundle":
      query = sql<Row>`SELECT id, teacher_id FROM course_bundles
        WHERE ${byKey("course_bundles.id", "course_bundles.slug")} AND is_published = true LIMIT 1`;
      break;
    case "teacher_profile":
      query = sql<Row>`SELECT id, id AS teacher_id FROM users
        WHERE ${byKey("users.id", "users.slug")} AND role = 'teacher' AND is_active = true LIMIT 1`;
      break;
  }
  const result = await query.execute(db);
  const row = result.rows[0];
  if (!row) return null;
  const entityId = Number(row.id);
  const teacherId = Number(row.teacher_id ?? row.teacherId);
  return Number.isFinite(entityId) && Number.isFinite(teacherId) ? { entityId, teacherId } : null;
}

// A tiny 200 rather than a 204: the Floot preview's fetch wrapper throws on an
// empty-body status.
const accepted = () =>
  new Response(superjson.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });

/**
 * Public: records one storefront event for the teacher Analytics page.
 * Deduplicated per browser session, event, item and hour by a unique key.
 * No IP address or user agent is stored. Views and add-to-cart by the owning
 * teacher, their team or an admin are dropped so a teacher checking their own
 * page does not count as a visitor; shares are kept whoever makes them.
 */
export async function handle(request: Request): Promise<Response> {
  let input;
  try {
    input = schema.parse(superjson.parse(await request.text()));
  } catch {
    return new Response(superjson.stringify({ error: "Invalid event" }), { status: 400 });
  }

  try {
    const target = await resolveEntity(input.entity, input.id, input.slug);
    if (!target) return accepted();

    let userId: number | null = null;
    if (input.event !== "share") {
      try {
        const { user, effectiveTeacherId } = await getServerUserSession(request);
        if (user.role === "admin") return accepted();
        if (user.role === "teacher" && effectiveTeacherId === target.teacherId) return accepted();
        userId = user.id;
      } catch {
        // Signed out: an anonymous visitor.
      }
    }

    const isShare = input.event === "share";
    await sql`
      INSERT INTO storefront_events
        (bucket_hour, event_type, entity_type, entity_id, teacher_id, session_id, user_id,
         source, utm_source, utm_medium, utm_campaign, referrer_host, device, platform)
      VALUES
        (date_trunc('hour', now()), ${input.event}, ${input.entity}, ${target.entityId}, ${target.teacherId},
         ${input.sessionId}, ${userId},
         ${isShare ? "share_button" : classifySource(input.utmSource, input.referrerHost)},
         ${isShare ? null : input.utmSource}, ${isShare ? null : input.utmMedium},
         ${isShare ? input.campaign : input.utmCampaign}, ${isShare ? null : input.referrerHost},
         ${input.device ?? null}, ${isShare ? input.platform ?? "" : ""})
      ON CONFLICT DO NOTHING
    `.execute(db);

    return accepted();
  } catch (error) {
    console.error("Error recording storefront event:", error);
    return new Response(superjson.stringify({ error: "Could not record event" }), { status: 500 });
  }
}