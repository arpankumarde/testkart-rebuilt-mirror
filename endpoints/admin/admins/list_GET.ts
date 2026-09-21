import { OutputType } from "./list_GET.schema";
import superjson from 'superjson';
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const adminsList = await db
      .selectFrom('admins')
      .select([
        'id',
        'email',
        'fullName',
        'role',
        'permissions',
        'isActive',
        'lastLoginAt',
        'createdAt'
      ])
      .orderBy('createdAt', 'desc')
      .execute();

    return new Response(superjson.stringify({ admins: adminsList } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}