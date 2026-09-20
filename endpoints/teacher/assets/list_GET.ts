import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { listTeacherAssets, syncTeacherAssetsFromContent } from "../../../helpers/teacherAssetLibrary";
import { OutputType } from "./list_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teachers have an asset library." }), { status: 403 });
    }

    try {
      await syncTeacherAssetsFromContent(effectiveTeacherId);
    } catch (error) {
      // The library still lists what it already holds.
      console.error(`[teacher/assets/list] Sync failed for teacher ${effectiveTeacherId}:`, error);
    }

    const assets = await listTeacherAssets(effectiveTeacherId);
    return new Response(superjson.stringify({ assets } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error listing teacher assets:", error);
    return new Response(superjson.stringify({ error: "Your library could not be loaded." }), { status: 500 });
  }
}