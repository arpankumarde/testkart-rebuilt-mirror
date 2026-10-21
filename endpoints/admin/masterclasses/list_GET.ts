import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, AdminMasterclassRow } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const rows = await db
      .selectFrom("masterclasses as m")
      .select([
        "m.id",
        "m.slug",
        "m.title",
        "m.subtitle",
        "m.description",
        "m.coverImageUrl",
        "m.coverImageFileId",
        "m.hostName",
        "m.hostTitle",
        "m.hostImageUrl",
        "m.platformLabel",
        "m.joinUrl",
        "m.startTime",
        "m.durationMinutes",
        "m.capacity",
        "m.status",
        "m.createdAt",
        sql<string>`(SELECT COUNT(*) FROM masterclass_registrations r WHERE r.masterclass_id = m.id)`.as("registrantCount"),
        sql<string>`(SELECT COUNT(*) FROM masterclass_registrations r WHERE r.masterclass_id = m.id AND r.attended = true)`.as("attendedCount"),
      ])
      .orderBy("m.startTime", "desc")
      .execute();

    const masterclasses: AdminMasterclassRow[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      subtitle: r.subtitle,
      description: r.description,
      coverImageUrl: r.coverImageUrl,
      coverImageFileId: r.coverImageFileId,
      hostName: r.hostName,
      hostTitle: r.hostTitle,
      hostImageUrl: r.hostImageUrl,
      platformLabel: r.platformLabel,
      joinUrl: r.joinUrl,
      startTime: r.startTime,
      durationMinutes: r.durationMinutes,
      capacity: r.capacity,
      status: r.status,
      registrantCount: Number(r.registrantCount),
      attendedCount: Number(r.attendedCount),
      createdAt: r.createdAt,
    }));

    return new Response(superjson.stringify({ masterclasses } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching admin masterclasses:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to load masterclasses" }),
      { status: 400 }
    );
  }
}
