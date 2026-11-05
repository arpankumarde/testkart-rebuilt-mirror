import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const material = await db
      .selectFrom("liveLessonMaterials")
      .select(["id", "teacherId"])
      .where("id", "=", input.id)
      .executeTakeFirst();
    if (!material) {
      return new Response(superjson.stringify({ error: "Material not found" }), { status: 404 });
    }
    if (material.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Only the teacher who added this can remove it." }), { status: 403 });
    }

    await db.deleteFrom("liveLessonMaterials").where("id", "=", input.id).execute();

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error deleting classroom material:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
