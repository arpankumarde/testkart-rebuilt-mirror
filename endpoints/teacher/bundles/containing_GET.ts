import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { findPublishedBundlesContaining } from "../../../helpers/bundleDependencies";
import { schema, OutputType } from "./containing_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const parsed = schema.safeParse({
      itemType: url.searchParams.get("itemType"),
      ids: (url.searchParams.get("ids") ?? "")
        .split(",")
        .filter((part) => part !== "")
        .map(Number),
    });

    if (!parsed.success) {
      return new Response(
        superjson.stringify({ error: "itemType and a list of item ids are required" }),
        { status: 400 }
      );
    }

    const bundles = await findPublishedBundlesContaining(
      db,
      parsed.data.itemType,
      parsed.data.ids,
      { teacherId: effectiveTeacherId }
    );

    const output: OutputType = { bundles };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error checking bundles for items:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to check bundles", details: errorMessage }),
      { status: 500 }
    );
  }
}
