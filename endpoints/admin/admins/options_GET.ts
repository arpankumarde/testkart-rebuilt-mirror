import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import type { OutputType } from "./options_GET.schema";

// Admin names for pickers such as an exam's owner. admin/admins/list is for
// super admins only; this is readable by every role that works on content, so
// it carries no emails, roles or login times.
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);

    const rows = await db
      .selectFrom("admins")
      .select(["id", "fullName", "isActive"])
      .orderBy("fullName", "asc")
      .execute();

    return new Response(
      superjson.stringify({
        admins: rows.map((row) => ({ id: row.id, fullName: row.fullName, isActive: row.isActive === true })),
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}