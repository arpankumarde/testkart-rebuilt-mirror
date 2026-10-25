import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { jsonbParam } from "../../../helpers/jsonbParam";
import { MasterclassCoHost, normalizeWebsite } from "../../../helpers/masterclassCoHosts";
import { loadAdminPresenterProfiles } from "../../../helpers/masterclassPresenters";
import { schema, InputType, OutputType } from "./upsert_POST.schema";
import superjson from "superjson";

/**
 * Builds the stored co-host list. Admin entries are checked against active
 * admin accounts and take their name and photo from the account, never from the
 * request; the host and repeated admins are dropped.
 */
const buildCoHosts = async (
  input: NonNullable<InputType["coHosts"]>,
  hostAdminId: number
): Promise<MasterclassCoHost[]> => {
  const adminIds = input.flatMap((c) => (c.type === "admin" ? [c.userId] : []));
  const profiles = await loadAdminPresenterProfiles(adminIds);
  const seen = new Set<number>([hostAdminId]);
  const coHosts: MasterclassCoHost[] = [];
  for (const entry of input) {
    if (entry.type === "admin") {
      if (seen.has(entry.userId)) continue;
      const profile = profiles.get(entry.userId);
      if (!profile || !profile.isActive) throw new Error("A selected co-host is not an active admin.");
      seen.add(entry.userId);
      coHosts.push({
        type: "admin",
        userId: entry.userId,
        name: profile.fullName,
        title: entry.title || null,
        profileImage: profile.avatarUrl,
        imageFileId: null,
        organization: null,
        website: null,
      });
    } else {
      const website = entry.website ? normalizeWebsite(entry.website) : null;
      if (entry.website && !website) throw new Error(`Enter a valid website for ${entry.name}, or leave it blank.`);
      coHosts.push({
        type: "guest",
        userId: null,
        name: entry.name,
        title: entry.title || null,
        profileImage: entry.profileImage || null,
        imageFileId: entry.imageFileId || null,
        organization: entry.organization || null,
        website,
      });
    }
  }
  return coHosts;
};

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const existingWithSlug = await db
      .selectFrom("masterclasses")
      .select("id")
      .where("slug", "=", input.slug)
      .executeTakeFirst();
    if (existingWithSlug && existingWithSlug.id !== input.id) {
      throw new Error("A masterclass with this slug already exists.");
    }

    const current = input.id
      ? await db
          .selectFrom("masterclasses")
          .select(["createdByAdminId", "hostAdminId"])
          .where("id", "=", input.id)
          .executeTakeFirst()
      : undefined;
    if (input.id && !current) throw new Error("This masterclass could not be found.");

    // Any active admin can be the host. With none chosen, an existing record
    // keeps its host and a new one is hosted by the admin creating it.
    const hostAdminId = input.hostAdminId ?? current?.hostAdminId ?? current?.createdByAdminId ?? admin.id;
    const hostProfile = (await loadAdminPresenterProfiles([hostAdminId])).get(hostAdminId);
    if (!hostProfile || !hostProfile.isActive) throw new Error("Choose an active admin as the host.");

    const coHosts = input.coHosts !== undefined ? await buildCoHosts(input.coHosts, hostAdminId) : undefined;

    const values = {
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle || null,
      description: input.description || null,
      coverImageUrl: input.coverImageUrl || null,
      coverImageFileId: input.coverImageFileId || null,
      hostAdminId,
      // Snapshot for the reminder emails and for readers that cannot join.
      hostName: hostProfile.fullName,
      hostTitle: input.hostTitle || null,
      hostImageUrl: input.hostImageUrl || null,
      platformLabel: input.platformLabel || null,
      joinUrl: input.joinUrl || null,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes ?? 60,
      capacity: input.capacity ?? null,
      status: input.status,
      ...(coHosts !== undefined && { coHosts: jsonbParam(coHosts) }),
    };

    let id: number;
    if (input.id) {
      const updated = await db
        .updateTable("masterclasses")
        .set({ ...values, updatedAt: new Date() })
        .where("id", "=", input.id)
        .returning("id")
        .executeTakeFirstOrThrow();
      id = updated.id;
    } else {
      const inserted = await db
        .insertInto("masterclasses")
        .values({ ...values, createdByAdminId: admin.id })
        .returning("id")
        .executeTakeFirstOrThrow();
      id = inserted.id;
    }

    return new Response(superjson.stringify({ success: true, id } satisfies OutputType));
  } catch (error) {
    console.error("[admin/masterclasses/upsert] Failed:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to save masterclass." }),
      { status: 400 }
    );
  }
}