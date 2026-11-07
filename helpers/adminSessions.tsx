import type { Kysely } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { parseUserAgent } from "./orderClientInfo";

/*
 * Sign-ins to the admin panel, one admin_sessions row per browser. Rows are written by
 * helpers/getAdminSession; a revoked row ends that browser's session on its next request. An admin
 * manages their own on Profile; a super admin manages everyone's from Settings.
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
  /** The super admin who opened this session with "Sign in as", or null for the admin's own sign-in. */
  openedBy: string | null;
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

/** Live sign-ins, this browser first, then the most recently active. */
export async function listAdminSessions(
  adminId: number,
  currentSessionId: string | undefined
): Promise<AdminSessionSummary[]> {
  const rows = await db
    .selectFrom("adminSessions")
    .leftJoin("admins as opener", "opener.id", "adminSessions.impersonatorAdminId")
    .select([
      "adminSessions.id",
      "adminSessions.ipAddress",
      "adminSessions.userAgent",
      "adminSessions.createdAt",
      "adminSessions.lastSeenAt",
      "opener.fullName as openedBy",
    ])
    .where("adminSessions.adminId", "=", adminId)
    .where("adminSessions.revokedAt", "is", null)
    .where("adminSessions.expiresAt", ">", new Date())
    .orderBy("adminSessions.lastSeenAt", "desc")
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
      openedBy: row.openedBy ?? null,
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
 * Ends every sign-in of the admin, apart from keepSessionId when given, and every session they
 * opened as another admin. Takes a transaction so password resets and deactivation can do it with
 * their own writes.
 */
export async function revokeAdminSessions(
  adminId: number,
  keepSessionId?: string,
  executor: Kysely<DB> = db
): Promise<number> {
  let query = executor
    .updateTable("adminSessions")
    .set({ revokedAt: new Date() })
    .where((eb) => eb.or([eb("adminId", "=", adminId), eb("impersonatorAdminId", "=", adminId)]))
    .where("revokedAt", "is", null)
    .where("expiresAt", ">", new Date());
  if (keepSessionId) query = query.where("id", "!=", keepSessionId);
  const result = await query.executeTakeFirst();
  return Number(result.numUpdatedRows);
}

/**
 * Signs an admin out everywhere. session_invalidated_at also ends older sign-ins that have not been
 * seen since sessions were recorded and so have no row to revoke.
 */
export async function signOutAdminEverywhere(adminId: number): Promise<number> {
  const ended = await revokeAdminSessions(adminId);
  await db.updateTable("admins").set({ sessionInvalidatedAt: new Date() }).where("id", "=", adminId).execute();
  return ended;
}

/** Rows whose cookie has expired can never be used again, so nothing depends on them. */
export async function deleteExpiredAdminSessions(): Promise<void> {
  await db.deleteFrom("adminSessions").where("expiresAt", "<", new Date()).execute();
}
