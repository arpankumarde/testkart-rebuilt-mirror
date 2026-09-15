import { db } from "./db";

// Scheduled job (see static/__dev/scheduled-jobs.json) that keeps
// ai_generation_logs small, fast, and accurate — the two "measures in
// advance" against server impact from this table growing unbounded:
//
// 1. Stuck "pending" rows (the request crashed/timed out before the
//    completing update ran) are swept to "failed" after 15 minutes, so the
//    admin page's pending count never silently grows forever.
// 2. Rows older than the retention window are deleted, so the table (and
//    its indexes) stay small and admin queries stay fast indefinitely,
//    regardless of how much AI usage the platform accumulates over time.
const STALE_PENDING_MINUTES = 15;
const RETENTION_DAYS = 90;

export async function aiLogsCleanup(): Promise<void> {
  console.log("[aiLogsCleanup] Starting scheduled job...");

  try {
    const staleThreshold = new Date(Date.now() - STALE_PENDING_MINUTES * 60 * 1000);
    const staleResult = await db
      .updateTable("aiGenerationLogs")
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: "Timed out (no response recorded after 15 minutes).",
      })
      .where("status", "=", "pending")
      .where("createdAt", "<", staleThreshold)
      .executeTakeFirst();

    console.log(`[aiLogsCleanup] Marked ${staleResult.numUpdatedRows} stale pending log(s) as failed.`);
  } catch (error) {
    console.error("[aiLogsCleanup] Failed to sweep stale pending logs:", error);
  }

  try {
    const retentionThreshold = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const deleteResult = await db
      .deleteFrom("aiGenerationLogs")
      .where("createdAt", "<", retentionThreshold)
      .executeTakeFirst();

    console.log(`[aiLogsCleanup] Deleted ${deleteResult.numDeletedRows} log(s) older than ${RETENTION_DAYS} days.`);
  } catch (error) {
    console.error("[aiLogsCleanup] Failed to prune old logs:", error);
  }

  console.log("[aiLogsCleanup] Scheduled job completed.");
}
