import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import type { OutputType } from "./options_GET.schema";

// Admin names and photos for pickers such as an exam's owner or a masterclass
// host. admin/admins/list needs the admins module; this is readable by every
// admin, so it carries no emails, roles or login times.
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const rows = await db
      .selectFrom("admins")
      .select(["id", "fullName", "isActive", "avatarUrl"])
      .orderBy("fullName", "asc")
      .execute();

    return new Response(
      superjson.stringify({
        admins: rows.map((row) => ({
          id: row.id,
          fullName: row.fullName,
          isActive: row.isActive === true,
          avatarUrl: row.avatarUrl ?? null,
        })),
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}