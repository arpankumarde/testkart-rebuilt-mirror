import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { getPublicUrl, r2ObjectExists } from "../../../helpers/r2Client";
import { assetKindForMime } from "../../../helpers/teacherAssetFiles";
import { listTeacherAssets } from "../../../helpers/teacherAssetLibrary";
import { schema, OutputType } from "./create_POST.schema";

const fail = (error: string, status: number) => new Response(superjson.stringify({ error }), { status });

/** Adds a file the teacher just uploaded to R2 to their library. */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") return fail("Only teachers have an asset library.", 403);

    const input = schema.parse(superjson.parse(await request.text()));
    const key = input.key.replace(/^\/+/, "");

    const kind = assetKindForMime(input.mimeType);
    if (!kind) return fail("Only MP4, WebM or MOV videos and PDF files can be added to the library.", 400);

    const upload = await db
      .selectFrom("uploadedFiles")
      .select("ownerUserId")
      .where("key", "=", key)
      .executeTakeFirst();
    if (!upload || upload.ownerUserId !== effectiveTeacherId) {
      return fail("This file was not uploaded from your account.", 403);
    }

    if (!(await r2ObjectExists(key))) {
      return fail("The upload did not finish. Upload the file again.", 400);
    }

    const row = await db
      .insertInto("teacherAssets")
      .values({
        teacherId: effectiveTeacherId,
        key,
        url: getPublicUrl(key),
        name: input.name,
        kind,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes ?? null,
        durationSeconds: input.durationSeconds ?? null,
      })
      .onConflict((oc) => oc.columns(["teacherId", "key"]).doUpdateSet({ updatedAt: new Date() }))
      .returning("id")
      .executeTakeFirstOrThrow();

    const [asset] = await listTeacherAssets(effectiveTeacherId, row.id);
    return new Response(superjson.stringify({ asset } satisfies OutputType), { status: 201 });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return fail("Not authenticated", 401);
    console.error("Error adding teacher asset:", error);
    return fail("The file could not be added to your library.", 500);
  }
}