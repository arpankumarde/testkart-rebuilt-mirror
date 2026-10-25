// Server-only: resolves a masterclass's host and co-hosts against the admins
// table, so names and photos follow the live accounts. Presenters are never
// linked to a teacher profile, even when the admin also has one.
import { db } from "./db";
import { MasterclassPresenter, parseMasterclassCoHosts } from "./masterclassCoHosts";

export type AdminPresenterProfile = {
  id: number;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
};

export const loadAdminPresenterProfiles = async (ids: number[]): Promise<Map<number, AdminPresenterProfile>> => {
  const unique = Array.from(new Set(ids.filter((id) => Number.isInteger(id))));
  if (unique.length === 0) return new Map();
  const rows = await db
    .selectFrom("admins")
    .select(["id", "fullName", "avatarUrl", "isActive"])
    .where("id", "in", unique)
    .execute();
  return new Map(
    rows.map((row) => [
      row.id,
      { id: row.id, fullName: row.fullName, avatarUrl: row.avatarUrl, isActive: row.isActive !== false },
    ])
  );
};

type MasterclassHostColumns = {
  hostAdminId: number | null;
  createdByAdminId: number | null;
  hostName: string | null;
  hostTitle: string | null;
  hostImageUrl: string | null;
  coHosts: unknown;
};

/**
 * The host first, then co-hosts in saved order. A linked admin who is no longer
 * active keeps the saved name and photo.
 */
export const resolveMasterclassPresenters = async (
  m: MasterclassHostColumns
): Promise<{ host: MasterclassPresenter | null; coHosts: MasterclassPresenter[] }> => {
  const hostAdminId = m.hostAdminId ?? m.createdByAdminId;
  const stored = parseMasterclassCoHosts(m.coHosts, { adminId: hostAdminId, name: m.hostName });
  const profiles = await loadAdminPresenterProfiles([
    ...(hostAdminId ? [hostAdminId] : []),
    ...stored.filter((c) => c.type === "admin").map((c) => c.userId!),
  ]);

  const hostProfile = hostAdminId ? profiles.get(hostAdminId) : undefined;
  const hostName = hostProfile?.fullName || m.hostName;
  const host: MasterclassPresenter | null = hostName
    ? {
        type: "admin",
        name: hostName,
        title: m.hostTitle,
        profileImage: hostProfile?.avatarUrl || m.hostImageUrl || null,
        organization: null,
        website: null,
      }
    : null;

  const coHosts = stored.map((coHost): MasterclassPresenter => {
    if (coHost.type === "admin") {
      const profile = profiles.get(coHost.userId!);
      const live = profile?.isActive ? profile : undefined;
      return {
        type: "admin",
        name: live?.fullName || coHost.name,
        title: coHost.title,
        profileImage: live?.avatarUrl || coHost.profileImage,
        organization: null,
        website: null,
      };
    }
    return {
      type: "guest",
      name: coHost.name,
      title: coHost.title,
      profileImage: coHost.profileImage,
      organization: coHost.organization,
      website: coHost.website,
    };
  });

  return { host, coHosts };
};
