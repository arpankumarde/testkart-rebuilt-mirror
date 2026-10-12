import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { effectiveTeacherId } = await getServerUserSession(request);

    const url = new URL(request.url);
    const input = schema.parse({ organizationId: url.searchParams.get("organizationId") });

    const org = await db
      .selectFrom("organizations")
      .select(["id", "createdByTeacherId"])
      .where("id", "=", input.organizationId)
      .executeTakeFirst();

    if (!org || org.createdByTeacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "Only the organisation's creator can manage its gallery." }),
        { status: 403 }
      );
    }

    const rows = await db
      .selectFrom("organizationGalleryItems")
      .select(["id", "mediaType", "url", "fileId", "caption", "createdAt"])
      .where("organizationId", "=", input.organizationId)
      .orderBy("orderIndex", "asc")
      .orderBy("createdAt", "asc")
      .execute();

    const response: OutputType = {
      items: rows.map((r) => ({
        id: r.id,
        mediaType: r.mediaType as "photo" | "video",
        url: r.url,
        fileId: r.fileId,
        caption: r.caption,
        createdAt: r.createdAt,
      })),
    };

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Failed to list organization gallery:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to load gallery.", details: errorMessage }),
      { status: 500 }
    );
  }
}
