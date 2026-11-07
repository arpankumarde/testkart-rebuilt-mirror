import type { Kysely } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { parseUserAgent } from "./orderClientInfo";

/*
 * An admin's own sign-ins to the admin panel, one admin_sessions row per browser. Rows are written
 * by helpers/getAdminSession; a revoked row ends that browser's session on its next request.
 */

export type AdminSessionDevice = "mobile" | "tablet" | "desktop" | "unknown";

export type AdminSessionSummary = {
  id: string;
  isCurrent: boolean;
  /** For example "Chrome on Windows". */
  label: string;
  device: AdminSessionDevice;
  ipAddress: string | null;
  signedInAt: Date;
  lastActiveAt: Date;
};

function describe(userAgent: string | null): { label: string; device: AdminSessionDevice } {
  if (!userAgent) return { label: "Unknown device", device: "unknown" };
  const parsed = parseUserAgent(userAgent);
  const browser = parsed.browserName ?? "Unknown browser";
  return {
    label: parsed.osName ? `${browser} on ${parsed.osName}` : browser,
    device: parsed.deviceType,
  };
}

const liveSessions = (adminId: number) =>
  db
    .selectFrom("adminSessions")
    .where("adminId", "=", adminId)
    .where("revokedAt", "is", null)
    .where("expiresAt", ">", new Date());

/** Live sign-ins, this browser first, then the most recently active. */
export async function listAdminSessions(
  adminId: number,
  currentSessionId: string | undefined
): Promise<AdminSessionSummary[]> {
  const rows = await liveSessions(adminId)
    .select(["id", "ipAddress", "userAgent", "createdAt", "lastSeenAt"])
    .orderBy("lastSeenAt", "desc")
    .limit(100)
    .execute();

  return rows
    .map((row) => ({
      id: row.id,
      isCurrent: row.id === currentSessionId,
      ...describe(row.userAgent),
      ipAddress: row.ipAddress,
      signedInAt: new Date(row.createdAt),
      lastActiveAt: new Date(row.lastSeenAt),
    }))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}

/** Ends one of the admin's sign-ins. Returns false when it is not theirs or has already ended. */
export async function revokeAdminSession(adminId: number, sessionId: string): Promise<boolean> {
  const result = await db
    .updateTable("adminSessions")
    .set({ revokedAt: new Date() })
    .where("id", "=", sessionId)
    .where("adminId", "=", adminId)
    .where("revokedAt", "is", null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

/**
 * Ends every sign-in of the admin, apart from keepSessionId when given. Takes a transaction so
 * password resets and deactivation can do it with their own writes.
 */
export async function revokeAdminSessions(
  adminId: number,
  keepSessionId?: string,
  executor: Kysely<DB> = db
): Promise<number> {
  let query = executor
    .updateTable("adminSessions")
    .set({ revokedAt: new Date() })
    .where("adminId", "=", adminId)
    .where("revokedAt", "is", null)
    .where("expiresAt", ">", new Date());
  if (keepSessionId) query = query.where("id", "!=", keepSessionId);
  const result = await query.executeTakeFirst();
  return Number(result.numUpdatedRows);
}

/** Rows whose cookie has expired can never be used again, so nothing depends on them. */
export async function deleteExpiredAdminSessions(): Promise<void> {
  await db.deleteFrom("adminSessions").where("expiresAt", "<", new Date()).execute();
}
