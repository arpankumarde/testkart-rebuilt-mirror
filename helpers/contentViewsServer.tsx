import { createHash } from "crypto";
import { sql } from "kysely";
import { db } from "./db";
import { getClientIp } from "./getClientIp";
import { CONTENT_VIEW_DEDUP_MINUTES, type ContentViewKind } from "../endpoints/content-views/record_POST.schema";

/*
 * Public view counts for Exam News stories and Current Affairs posts, shown only in the admin listings.
 * A view counts once per visitor (hashed IP and user agent) per post inside the dedup window, and only
 * while the post is published. Admin previews render their own components and never record a view.
 */

const TABLES: Record<ContentViewKind, string> = {
  exam_news: "exam_news_posts",
  current_affairs: "current_affairs_posts",
};

const BOT_AGENT =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegram|embedly|preview|headless|lighthouse|pagespeed|curl|wget|python|axios|node-fetch|go-http/i;
/* The Floot editor preview shares the production database; its visits are the team's own. */
const EDITOR_HOST = /(^|\.)(floot\.com|sandbox\.floot\.app)$/i;
const PRUNE_CHANCE = 0.02;

const hostOf = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

export type RecordViewOutcome = "counted" | "duplicate" | "unavailable" | "bot" | "editor";

async function record(request: Request, kind: ContentViewKind, postId: number): Promise<RecordViewOutcome> {
  const agent = request.headers.get("user-agent") ?? "";
  if (!agent || BOT_AGENT.test(agent)) return "bot";
  const host = hostOf(request.headers.get("origin")) ?? hostOf(request.headers.get("referer"));
  if (host && EDITOR_HOST.test(host)) return "editor";

  const visitor = createHash("sha256")
    .update(`${getClientIp(request) ?? "unknown"}|${agent}`)
    .digest("hex")
    .slice(0, 32);
  const table = sql.table(TABLES[kind]);

  // One statement: the hit row is claimed (or re-claimed once the window has passed) only for a
  // published post, and the counter moves only when the claim succeeded.
  const { rows } = await sql<{ live: boolean; counted: boolean }>`
    with live as (
      select id from ${table} where id = ${postId} and status = 'published'
    ), hit as (
      insert into content_view_hits (content_kind, post_id, visitor_hash, counted_at)
      select ${kind}, id, ${visitor}, now() from live
      on conflict (content_kind, post_id, visitor_hash) do update set counted_at = now()
        where content_view_hits.counted_at < now() - ${CONTENT_VIEW_DEDUP_MINUTES} * interval '1 minute'
      returning post_id
    ), bumped as (
      update ${table} set view_count = view_count + 1 where id in (select post_id from hit) returning id
    )
    select exists (select 1 from live) as live, exists (select 1 from bumped) as counted
  `.execute(db);

  if (Math.random() < PRUNE_CHANCE) {
    await db
      .deleteFrom("contentViewHits")
      .where("countedAt", "<", sql<Date>`now() - interval '1 day'`)
      .execute()
      .catch((error) => console.error("Could not prune content view hits:", error));
  }

  const row = rows[0];
  if (!row?.live) return "unavailable";
  return row.counted ? "counted" : "duplicate";
}

export const contentViewsServer = { record };
