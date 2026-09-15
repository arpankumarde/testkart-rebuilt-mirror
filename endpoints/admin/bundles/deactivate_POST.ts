import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./deactivate_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const json = superjson.parse(await request.text());
    const { bundleId } = schema.parse(json);

    const result = await db
      .updateTable("courseBundles")
      .set({
        isPublished: false,
        publishedAt: null,
      })
      .where("id", "=", bundleId)
      .where("isPublished", "=", true)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      const bundle = await db
        .selectFrom("courseBundles")
        .select("isPublished")
        .where("id", "=", bundleId)
        .executeTakeFirst();
      
      if (!bundle) {
        throw new Error("Course bundle not found.");
      }
      if (!bundle.isPublished) {
        throw new Error("Course bundle is not published and cannot be deactivated.");
      }
      throw new Error("Failed to deactivate course bundle.");
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Error deactivating course bundle:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}