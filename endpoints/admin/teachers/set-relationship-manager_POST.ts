import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./set-relationship-manager_POST.schema";
import superjson from "superjson";

/* Hands a teacher to another admin as their relationship manager. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { teacherId, adminId } = schema.parse(json);

    const admin = await db
      .selectFrom("admins")
      .select(["id", "fullName"])
      .where("id", "=", adminId)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!admin) {
      return new Response(
        superjson.stringify({ error: "Choose an active admin." }),
        { status: 400 }
      );
    }

    const updated = await db
      .updateTable("users")
      .set({ relationshipManagerAdminId: admin.id })
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

    const output: OutputType = { success: true, teacherId, adminId: admin.id, adminName: admin.fullName };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error setting teacher relationship manager:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}
