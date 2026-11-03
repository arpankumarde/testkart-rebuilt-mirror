/*
 * Temporary sign-in links an admin creates for a student or teacher (admin_login_links).
 * Shared by the admin dialog and the endpoints, so no server-only imports here.
 * The token travels in the URL fragment, which browsers never send to the server.
 */

export const LOGIN_LINK_PATH = "/login-link";

export const LOGIN_LINK_EXPIRY_OPTIONS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "7 days" },
] as const;

export const DEFAULT_LOGIN_LINK_EXPIRY_MINUTES = 60;

export const isLoginLinkExpiryOption = (minutes: number) =>
  LOGIN_LINK_EXPIRY_OPTIONS.some((option) => option.minutes === minutes);

export type LoginLinkStatus = "active" | "used" | "expired" | "revoked";

export interface LoginLinkView {
  id: number;
  status: LoginLinkStatus;
  expiresAt: Date;
  singleUse: boolean;
  useCount: number;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  note: string | null;
  createdBy: string;
  createdAt: Date;
}

interface LoginLinkRow {
  id: number;
  expiresAt: Date;
  singleUse: boolean;
  useCount: number;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  note: string | null;
  createdBy: string;
  createdAt: Date;
}

export function getLoginLinkStatus(row: LoginLinkRow, now: Date = new Date()): LoginLinkStatus {
  if (row.revokedAt) return "revoked";
  if (row.singleUse && row.useCount > 0) return "used";
  if (new Date(row.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

export function toLoginLinkView(row: LoginLinkRow): LoginLinkView {
  return {
    id: row.id,
    status: getLoginLinkStatus(row),
    expiresAt: row.expiresAt,
    singleUse: row.singleUse,
    useCount: row.useCount,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    revokedBy: row.revokedBy,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export function buildLoginLinkUrl(origin: string, token: string): string {
  return `${origin}${LOGIN_LINK_PATH}#${token}`;
}

export const LOGIN_LINK_COLUMNS = [
  "id",
  "expiresAt",
  "singleUse",
  "useCount",
  "lastUsedAt",
  "revokedAt",
  "revokedBy",
  "note",
  "createdBy",
  "createdAt",
] as const;