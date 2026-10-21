import { db } from "../../helpers/db";
import { OutputType, MasterclassListItem } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const rows = await db
      .selectFrom("masterclasses as m")
      .where("m.status", "=", "published")
      .select([
        "m.id",
        "m.slug",
        "m.title",
        "m.subtitle",
        "m.coverImageUrl",
        "m.hostName",
        "m.hostTitle",
        "m.startTime",
        "m.durationMinutes",
        "m.capacity",
        sql<string>`(SELECT COUNT(*) FROM masterclass_registrations r WHERE r.masterclass_id = m.id)`.as("registrantCount"),
      ])
      .orderBy("m.startTime", "asc")
      .execute();

    const now = Date.now();
    const masterclasses: MasterclassListItem[] = rows
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        coverImageUrl: r.coverImageUrl,
        hostName: r.hostName,
        hostTitle: r.hostTitle,
        startTime: r.startTime,
        durationMinutes: r.durationMinutes,
        capacity: r.capacity,
        registrantCount: Number(r.registrantCount),
        isPast: new Date(r.startTime).getTime() + (r.durationMinutes ?? 60) * 60 * 1000 < now,
      }))
      .sort((a, b) => {
        if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
        return a.isPast
          ? new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          : new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });

    return new Response(superjson.stringify({ masterclasses } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching masterclasses:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to load masterclasses" }),
      { status: 400 }
    );
  }
}
