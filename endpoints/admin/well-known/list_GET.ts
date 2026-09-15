import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { db } from "../../../helpers/db";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);
    
    const files = await db
      .selectFrom("wellKnownFiles")
      .selectAll()
      .orderBy("id")
      .execute();
      
    return new Response(superjson.stringify({ files } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
}