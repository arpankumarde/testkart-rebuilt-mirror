// Co-hosts live in masterclasses.co_hosts (jsonb, default []). Pure helpers,
// safe on the server and the client.

export const MAX_MASTERCLASS_CO_HOSTS = 6;

export type MasterclassCoHostType = "admin" | "guest";

/**
 * One stored co-host. An "admin" co-host links to an admin account by userId;
 * its name and photo are a snapshot taken when the masterclass was saved, and
 * readers prefer the live account. A "guest" has no account, so everything on
 * it was typed by the admin.
 */
export type MasterclassCoHost = {
  type: MasterclassCoHostType;
  userId: number | null;
  name: string;
  title: string | null;
  profileImage: string | null;
  /** R2 key of an uploaded guest photo, kept so the admin uploader can replace it. */
  imageFileId: string | null;
  organization: string | null;
  website: string | null;
};

/** What the public page gets for the host and for each co-host. */
export type MasterclassPresenter = {
  type: MasterclassCoHostType;
  name: string;
  title: string | null;
  profileImage: string | null;
  organization: string | null;
  website: string | null;
};

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
};

/** An http(s) URL, with https:// assumed when the scheme is missing; anything else is dropped. */
export const normalizeWebsite = (value: unknown): string | null => {
  const raw = text(value, 300);
  if (!raw || /\s/.test(raw)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    const isWeb = url.protocol === "https:" || url.protocol === "http:";
    return isWeb && /^[^.]+(\.[^.]+)+$/.test(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
};

/**
 * Reads the stored jsonb defensively. Entries saved before co-hosts had a type
 * (name, title, imageUrl) read as guests. Non-objects, blank names, a repeated
 * admin and the primary host are dropped.
 */
export const parseMasterclassCoHosts = (
  value: unknown,
  primary?: { adminId?: number | null; name?: string | null }
): MasterclassCoHost[] => {
  if (!Array.isArray(value)) return [];
  const primaryName = (primary?.name ?? "").trim().toLowerCase();
  const seenAdmins = new Set<number>();
  const coHosts: MasterclassCoHost[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const userId = typeof record.userId === "number" && Number.isInteger(record.userId) ? record.userId : null;
    const type: MasterclassCoHostType = record.type === "admin" && userId !== null ? "admin" : "guest";
    const name = text(record.name, 80);
    if (!name) continue;
    if (type === "admin") {
      if (userId === primary?.adminId || seenAdmins.has(userId!)) continue;
      seenAdmins.add(userId!);
    } else if (primaryName && name.toLowerCase() === primaryName) {
      continue;
    }
    coHosts.push({
      type,
      userId: type === "admin" ? userId : null,
      name,
      title: text(record.title, 80),
      profileImage: text(record.profileImage ?? record.imageUrl, 500),
      imageFileId: type === "guest" ? text(record.imageFileId, 300) : null,
      organization: type === "guest" ? text(record.organization, 120) : null,
      website: type === "guest" ? normalizeWebsite(record.website) : null,
    });
    if (coHosts.length >= MAX_MASTERCLASS_CO_HOSTS) break;
  }
  return coHosts;
};
