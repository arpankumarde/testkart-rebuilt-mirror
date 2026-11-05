import { sql } from "kysely";
import { db } from "../helpers/db";
import { isLinkPrefetch, safeRedirectPath } from "../helpers/messageLinkRules";
import { recordFunnelEvent } from "../helpers/recordFunnelEvent";

const CLICK_COOKIE_SECONDS = 72 * 60 * 60;
const CODE_RE = /^[0-9A-Za-z]{8}$/;

function redirect(origin: string, path: string, cookie?: string): Response {
  const headers = new Headers({
    Location: new URL(path, origin).toString(),
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

/**
 * Public: a tracked link from an autopilot email, WhatsApp or push
 * (helpers/createMessageLink). It logs the click against the message, sets
 * tk_mid for 72 hours so an order placed from this browser is credited to the
 * message, and redirects to the link's same-site path. Link previews and
 * scanners are logged as prefetches and never count as clicks. Unknown or
 * broken codes go to the home page.
 */
export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("c") ?? "";
  if (!CODE_RE.test(code)) return redirect(origin, "/");

  try {
    const link = await db
      .selectFrom("messageLinks")
      .select(["messageId", "targetPath"])
      .where("code", "=", code)
      .executeTakeFirst();
    if (!link) return redirect(origin, "/");

    const target = safeRedirectPath(link.targetPath) ?? "/";
    const prefetch = isLinkPrefetch(request.method, request.headers);
    if (!link.messageId) return redirect(origin, target);

    const message = await db
      .selectFrom("revMessages")
      .select(["userId", "intentId"])
      .where("id", "=", link.messageId)
      .executeTakeFirst();

    await db
      .insertInto("messageEvents")
      .values({
        messageId: link.messageId,
        provider: "link",
        type: prefetch ? "prefetch" : "click",
        isPrefetch: prefetch,
        raw: { code },
      })
      .execute();
    if (prefetch) return redirect(origin, target);

    await db
      .updateTable("revMessages")
      .set({ clickCount: sql`click_count + 1`, firstClickedAt: sql`coalesce(first_clicked_at, now())` })
      .where("id", "=", link.messageId)
      .execute();
    await recordFunnelEvent({
      event: "message_clicked",
      request,
      userId: message?.userId ?? null,
      messageId: link.messageId,
      intentId: message?.intentId ?? null,
      props: { code, path: target.slice(0, 100) },
    });

    const secure = url.protocol === "https:" ? "; Secure" : "";
    return redirect(
      origin,
      target,
      `tk_mid=${link.messageId}; Path=/; Max-Age=${CLICK_COOKIE_SECONDS}; SameSite=Lax${secure}`
    );
  } catch (error) {
    console.error("Tracked link failed:", error);
    return redirect(origin, "/");
  }
}