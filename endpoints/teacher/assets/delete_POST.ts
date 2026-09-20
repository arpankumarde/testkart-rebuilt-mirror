import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { deleteOwnedR2Files } from "../../../helpers/r2FileOwnership";
import { listTeacherAssets } from "../../../helpers/teacherAssetLibrary";
import { schema, OutputType } from "./delete_POST.schema";

const fail = (error: string, status: number) => new Response(superjson.stringify({ error }), { status });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/*
 * Removes a file from the library. A file still used by a lesson or study notes
 * stays, so a course never loses its video. Once the row is gone the R2 object is
 * deleted too, but only when this teacher uploaded it and nothing else points at it.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") return fail("Only teachers have an asset library.", 403);

    const input = schema.parse(superjson.parse(await request.text()));
    const [asset] = await listTeacherAssets(effectiveTeacherId, input.id);
    if (!asset) return fail("This file is no longer in your library.", 404);

    if (asset.lessonCount > 0 || asset.notesCount > 0) {
      const uses = [
        asset.lessonCount > 0 ? plural(asset.lessonCount, "course lesson") : null,
        asset.notesCount > 0 ? plural(asset.notesCount, "study note") : null,
      ]
        .filter(Boolean)
        .join(" and ");
      return fail(`This file is used in ${uses}. Remove it from there first, then delete it here.`, 409);
    }

    await db
      .deleteFrom("teacherAssets")
      .where("id", "=", asset.id)
      .where("teacherId", "=", effectiveTeacherId)
      .execute();

    await deleteOwnedR2Files(effectiveTeacherId, [asset.key]);

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return fail("Not authenticated", 401);
    console.error("Error deleting teacher asset:", error);
    return fail("The file could not be deleted.", 500);
  }
}