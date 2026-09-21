import { schema, OutputType } from "./deactivate_POST.schema";
import superjson from 'superjson';
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    const session = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    if (session.id === result.adminId) {
      throw new Error("You cannot deactivate your own account");
    }

    const updateData: { isActive: boolean; sessionInvalidatedAt?: Date } = {
      isActive: result.isActive
    };

    if (!result.isActive) {
      // Set sessionInvalidatedAt to now to invalidate any active sessions immediately
      updateData.sessionInvalidatedAt = new Date();
    }

    await db.updateTable('admins')
      .set(updateData)
      .where('id', '=', result.adminId)
      .execute();

    return new Response(superjson.stringify({ success: true, message: `Admin ${result.isActive ? 'activated' : 'deactivated'} successfully` } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}