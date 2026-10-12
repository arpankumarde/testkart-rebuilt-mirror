import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { sql } from "kysely";
import { schema, OutputType } from "./add_POST.schema";
import superjson from "superjson";

const MAX_GALLERY_ITEMS = 40;

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can manage an organisation gallery." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const org = await db
      .selectFrom("organizations")
      .select(["id", "createdByTeacherId"])
      .where("id", "=", input.organizationId)
      .executeTakeFirst();

    if (!org) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    if (org.createdByTeacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "Only the organisation's creator can manage its gallery." }),
        { status: 403 }
      );
    }

    const countRow = await db
      .selectFrom("organizationGalleryItems")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("organizationId", "=", input.organizationId)
      .executeTakeFirst();

    if (Number(countRow?.count ?? 0) >= MAX_GALLERY_ITEMS) {
      return new Response(
        superjson.stringify({ error: `You can add up to ${MAX_GALLERY_ITEMS} gallery items.` }),
        { status: 400 }
      );
    }

    const saved = await db
      .insertInto("organizationGalleryItems")
      .values({
        organizationId: input.organizationId,
        mediaType: input.mediaType,
        url: input.url,
        fileId: input.fileId ?? null,
        caption: input.caption ?? null,
        orderIndex: sql<number>`(
          SELECT COALESCE(MAX(order_index), -1) + 1
          FROM organization_gallery_items
          WHERE organization_id = ${input.organizationId}
        )`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const response: OutputType = {
      item: {
        id: saved.id,
        mediaType: saved.mediaType as "photo" | "video",
        url: saved.url,
        fileId: saved.fileId,
        caption: saved.caption,
        createdAt: saved.createdAt,
      },
    };

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Failed to add gallery item:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to add gallery item.", details: errorMessage }),
      { status: 500 }
    );
  }
}
