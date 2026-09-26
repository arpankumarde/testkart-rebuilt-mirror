import { db } from "./db";
import type { ContentType } from "./schema";
import { CONTENT_NOUNS } from "./contentReviewStatus";

/*
 * Posts to the admin team's Google Chat space when teacher content is queued
 * for review. Best effort: a missing webhook or a Chat outage never fails the
 * teacher's submit. Call it after the review row is committed and outside any
 * transaction, since it reads through the global db connection. Await it so the
 * request is sent before the endpoint returns.
 */

const SITE_URL = "https://testkart.in";
const TIMEOUT_MS = 4000;

export type QueuedReview = { contentType: ContentType; contentId: number; teacherId: number };

async function loadTitle(contentType: ContentType, id: number): Promise<string | null> {
  switch (contentType) {
    case "mock_test":
      return (await db.selectFrom("mockTests").select("title").where("id", "=", id).executeTakeFirst())?.title ?? null;
    case "course":
      return (await db.selectFrom("courses").select("title").where("id", "=", id).executeTakeFirst())?.title ?? null;
    case "digital_product":
      return (await db.selectFrom("digitalProducts").select("title").where("id", "=", id).executeTakeFirst())?.title ?? null;
    case "course_bundle":
      return (await db.selectFrom("courseBundles").select("title").where("id", "=", id).executeTakeFirst())?.title ?? null;
    case "live_test":
      return (await db.selectFrom("liveTests").select("title").where("id", "=", id).executeTakeFirst())?.title ?? null;
  }
}

/* Teacher-entered text must not inject Chat links or formatting. */
const plain = (value: string | null | undefined, fallback: string): string => {
  const text = (value ?? "").replace(/[<>*_~`|]/g, "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
};

const reviewLink = (review: QueuedReview) =>
  `${SITE_URL}/admin/preview/${review.contentType}/${review.contentId}?from=reviews`;

export async function sendReviewChatAlert(reviews: QueuedReview[]): Promise<void> {
  if (reviews.length === 0) return;
  const webhookUrl = process.env.GOOGLE_CHAT_REVIEW_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("GOOGLE_CHAT_REVIEW_WEBHOOK_URL is not set; skipped the review chat alert");
    return;
  }

  try {
    const teacherIds = [...new Set(reviews.map((r) => r.teacherId))];
    const teachers = await db
      .selectFrom("users")
      .select(["id", "displayName"])
      .where("id", "in", teacherIds)
      .execute();
    const teacherName = new Map(teachers.map((t) => [t.id, plain(t.displayName, `Teacher ${t.id}`)]));

    const lines: string[] = [];
    for (const review of reviews) {
      const title = plain(await loadTitle(review.contentType, review.contentId), "Untitled");
      const noun = CONTENT_NOUNS[review.contentType];
      const teacher = teacherName.get(review.teacherId) ?? `Teacher ${review.teacherId}`;
      lines.push(`${title} (${noun}) by ${teacher} - <${reviewLink(review)}|Review>`);
    }

    const heading =
      reviews.length === 1
        ? `*New ${CONTENT_NOUNS[reviews[0].contentType]} waiting for review*`
        : `*${reviews.length} items waiting for review*`;
    const text = [heading, ...lines, `<${SITE_URL}/admin/content-reviews?status=pending|Open the review queue>`].join("\n");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`Review chat alert failed with status ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
  } catch (error) {
    console.error("Review chat alert failed:", error);
  }
}
