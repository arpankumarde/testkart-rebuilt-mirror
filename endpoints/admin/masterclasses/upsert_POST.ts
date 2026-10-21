import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./upsert_POST.schema";
import superjson from "superjson";

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

    const values = {
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle || null,
      description: input.description || null,
      coverImageUrl: input.coverImageUrl || null,
      coverImageFileId: input.coverImageFileId || null,
      hostName: input.hostName || null,
      hostTitle: input.hostTitle || null,
      hostImageUrl: input.hostImageUrl || null,
      platformLabel: input.platformLabel || null,
      joinUrl: input.joinUrl || null,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes ?? 60,
      capacity: input.capacity ?? null,
      status: input.status,
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
