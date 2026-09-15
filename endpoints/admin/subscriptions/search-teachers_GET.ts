import { schema, OutputType } from "./search-teachers_GET.schema";
import { db } from "../../../helpers/db";
import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);
    
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const input = schema.parse({ q });
    
    const search = input.q.trim();
    
    const teachers = await db.selectFrom("users")
      .where("role", "=", "teacher")
      .where((eb) => eb.or([
        eb("displayName", "ilike", `%${search}%`),
        eb("email", "ilike", `%${search}%`),
      ]))
      .select(["id", "displayName", "email", "avatarUrl"])
      .limit(20)
      .execute();
      
    return new Response(superjson.stringify({ teachers } satisfies OutputType));
  } catch (error) {
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }), { status: 400 });
  }
}