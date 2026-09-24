import { sql } from "kysely";
import { db } from "./db";

const SIGNED_IN_LIMITS = { perMinute: 120, perDay: 3000 };
const SIGNED_OUT_LIMITS = { perMinute: 60, perDay: 600 };
const RETENTION_DAYS = 90;
const CLEANUP_PROBABILITY = 0.001;

export type PageViewEntry = {
  userId: number | null;
  ip: string | null;
  documentType: string;
  documentId: number;
  itemId: number | null;
  pageNumber: number;
};

// Logs one page served by the document reader and says whether the viewer is still inside the page limits,
// which stop bulk scraping. Signed-in viewers are counted per account, signed-out ones per IP address.
export async function recordPageView(entry: PageViewEntry): Promise<boolean> {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const minuteAgo = new Date(now - 60 * 1000);
  const limits = entry.userId !== null ? SIGNED_IN_LIMITS : SIGNED_OUT_LIMITS;

  if (entry.userId !== null || entry.ip !== null) {
    let counts = db
      .selectFrom("documentPageViews")
      .select([
        sql<string>`count(*)`.as("perDay"),
        sql<string>`count(*) filter (where created_at > ${minuteAgo})`.as("perMinute"),
      ])
      .where("createdAt", ">", dayAgo);
    counts =
      entry.userId !== null
        ? counts.where("userId", "=", entry.userId)
        : counts.where("userId", "is", null).where("ip", "=", entry.ip);
    const row = await counts.executeTakeFirst();
    if (Number(row?.perMinute ?? 0) >= limits.perMinute || Number(row?.perDay ?? 0) >= limits.perDay) {
      return false;
    }
  }

  await db.insertInto("documentPageViews").values(entry).execute();

  if (Math.random() < CLEANUP_PROBABILITY) {
    await db
      .deleteFrom("documentPageViews")
      .where("createdAt", "<", new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000))
      .execute()
      .catch((error) => console.error("Page view cleanup failed:", error));
  }
  return true;
}