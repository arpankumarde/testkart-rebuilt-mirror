import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";

// R2 cleanup for the item's file happens client-side (same convention as
// teacher posts / avatar uploads) - this endpoint only deletes the DB row.
// The caller already has the item's fileId from its own gallery list query,
// so it can trigger deleteR2File itself after this call succeeds.
export async function handle(request: Request) {
  try {
    const { effectiveTeacherId } = await getServerUserSession(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const item = await db
      .selectFrom("organizationGalleryItems")
      .innerJoin("organizations", "organizations.id", "organizationGalleryItems.organizationId")
      .select([
        "organizationGalleryItems.id",
        "organizationGalleryItems.fileId",
        "organizations.createdByTeacherId",
      ])
      .where("organizationGalleryItems.id", "=", input.galleryItemId)
      .executeTakeFirst();

    if (!item) {
      return new Response(superjson.stringify({ error: "Gallery item not found." }), { status: 404 });
    }

    if (item.createdByTeacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "Only the organisation's creator can manage its gallery." }),
        { status: 403 }
      );
    }

    await db.deleteFrom("organizationGalleryItems").where("id", "=", input.galleryItemId).execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Failed to delete gallery item:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to delete gallery item.", details: errorMessage }),
      { status: 500 }
    );
  }
}
