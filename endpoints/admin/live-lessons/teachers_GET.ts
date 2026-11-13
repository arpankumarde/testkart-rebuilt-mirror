import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import type { OutputType } from "./teachers_GET.schema";

/* Teachers who have at least one 1:1 booking, for the module's teacher filters. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const { rows } = await sql<{ id: number; displayName: string | null }>`
      SELECT u.id, u.display_name
      FROM users u
      WHERE u.id IN (SELECT teacher_id FROM mentorship_bookings)
      ORDER BY lower(coalesce(u.display_name, '')), u.id
      LIMIT 2000
    `.execute(db);
    const output: OutputType = {
      teachers: rows.map((r) => ({ id: r.id, name: r.displayName?.trim() || `Teacher #${r.id}` })),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live teachers failed:", error);
    const message = error instanceof Error ? error.message : "Could not load teachers.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}