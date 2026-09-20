import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { listTeacherAssets } from "../../../helpers/teacherAssetLibrary";
import { schema, OutputType } from "./rename_POST.schema";

const fail = (error: string, status: number) => new Response(superjson.stringify({ error }), { status });

/** Renames a library item. Lessons and notes that use the file keep their own titles. */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") return fail("Only teachers have an asset library.", 403);

    const input = schema.parse(superjson.parse(await request.text()));

    const updated = await db
      .updateTable("teacherAssets")
      .set({ name: input.name, updatedAt: new Date() })
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .returning("id")
      .executeTakeFirst();
    if (!updated) return fail("This file is no longer in your library.", 404);

    const [asset] = await listTeacherAssets(effectiveTeacherId, updated.id);
    return new Response(superjson.stringify({ asset } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return fail("Not authenticated", 401);
    console.error("Error renaming teacher asset:", error);
    return fail("The file could not be renamed.", 500);
  }
}