import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { OutputType } from "./grants_GET.schema";

const LIMIT = 50;

/** The latest coin grants, from the admin form and from autopilot offers. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const rows = await db
      .selectFrom("tcoinGrants")
      .leftJoin("users", "users.id", "tcoinGrants.userId")
      .select([
        "tcoinGrants.id",
        "tcoinGrants.createdAt",
        "tcoinGrants.coins",
        "tcoinGrants.reason",
        "tcoinGrants.grantedBy",
        "tcoinGrants.expiresAt",
        "users.displayName as studentName",
        "users.email as studentEmail",
      ])
      .orderBy("tcoinGrants.id", "desc")
      .limit(LIMIT)
      .execute();
    return new Response(superjson.stringify({ grants: rows } satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to load Tcoin grants" }),
      { status: 400 }
    );
  }
}