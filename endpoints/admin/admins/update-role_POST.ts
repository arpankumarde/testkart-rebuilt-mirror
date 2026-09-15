import { schema, OutputType } from "./update-role_POST.schema";
import superjson from 'superjson';
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    const session = await getAdminServerSessionOrThrow(request, ['super_admin']);

    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    if (session.id === result.adminId) {
      throw new Error("You cannot change your own role");
    }

    const targetAdmin = await db
      .selectFrom('admins')
      .select(['role'])
      .where('id', '=', result.adminId)
      .executeTakeFirst();

    if (!targetAdmin) {
      throw new Error("Admin not found");
    }

    await db.updateTable('admins')
      .set({ role: result.role })
      .where('id', '=', result.adminId)
      .execute();

    return new Response(superjson.stringify({ success: true, message: "Admin role updated successfully" } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}