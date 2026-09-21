import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./toggle-drm_POST.schema";
import superjson from "superjson";

/* Turns the per-teacher DRM opt-in on or off. Only the flag is stored here. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { teacherId, drmEnabled } = schema.parse(json);

    const updated = await db
      .updateTable("users")
      .set({ drmEnabled })
      .where("id", "=", teacherId)
      .where("role", "=", "teacher")
      .returning("id")
      .executeTakeFirst();

    if (!updated) {
      return new Response(
        superjson.stringify({ error: "Teacher not found." }),
        { status: 404 }
      );
    }

    const output: OutputType = { success: true, teacherId, drmEnabled };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error toggling teacher DRM:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}