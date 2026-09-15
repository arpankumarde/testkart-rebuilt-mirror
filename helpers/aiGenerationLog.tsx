import { db } from "./db";

// Lightweight, fire-and-forget-safe logging for every AI generation attempt
// across the platform (question generation, AI rewrite, AI generate-all).
//
// Performance/safety measures taken deliberately, per design:
// 1. Two tiny, single-row, indexed writes per attempt (insert + update) —
//    each is sub-10ms and negligible next to the multi-second AI API call
//    they wrap. Never a heavy query.
// 2. Every function here NEVER throws. Logging failures are caught and
//    console.error'd only — they must never break or slow down the actual
//    AI generation flow for a teacher.
// 3. We store compact, structured metadata only (a handful of small fields
//    in requestMeta), never full prompts/AI responses, keeping rows small
//    and the table cheap to scan/index as it grows.
// 4. A scheduled job (helpers/aiLogsCleanup.tsx) sweeps orphaned "pending"
//    rows (e.g. from a crashed/timed-out request) and prunes old rows, so
//    the table and its indexes stay small and admin queries stay fast.

export type AiGenerationFeature = "question_generation" | "rewrite" | "generate_all";
export type AiGenerationStatus = "pending" | "done" | "failed";

/**
 * Inserts a "pending" row right before calling the external AI API.
 * Returns the log id to complete later, or null if logging failed (caller
 * should proceed with the AI call regardless — logging must never block it).
 */
export async function startAiGenerationLog(
  teacherId: number,
  feature: AiGenerationFeature,
  requestMeta?: Record<string, unknown>
): Promise<number | null> {
  try {
    const row = await db
      .insertInto("aiGenerationLogs")
      .values({
        teacherId,
        feature,
        status: "pending",
        requestMeta: (requestMeta ?? null) as any,
      })
      .returning("id")
      .executeTakeFirst();
    return row?.id ?? null;
  } catch (error) {
    console.error("[aiGenerationLog] Failed to write pending log:", error);
    return null;
  }
}

/**
 * Marks a previously-started log as done/failed. Safe to call even if
 * logId is null (e.g. the initial insert failed) — it's a no-op then.
 */
export async function completeAiGenerationLog(
  logId: number | null,
  status: Extract<AiGenerationStatus, "done" | "failed">,
  options?: { errorMessage?: string; startedAt?: number | null }
): Promise<void> {
  if (logId === null) return;
  try {
    const durationMs =
      options?.startedAt !== undefined && options?.startedAt !== null
        ? Date.now() - options.startedAt
        : null;
    await db
      .updateTable("aiGenerationLogs")
      .set({
        status,
        completedAt: new Date(),
        durationMs,
        // Truncate defensively so a huge provider error message can never bloat the row.
        errorMessage: options?.errorMessage ? options.errorMessage.slice(0, 500) : null,
      })
      .where("id", "=", logId)
      .execute();
  } catch (error) {
    console.error("[aiGenerationLog] Failed to complete log:", error);
  }
}
