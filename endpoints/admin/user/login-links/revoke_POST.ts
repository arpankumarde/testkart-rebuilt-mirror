import { z } from "zod";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { LOGIN_LINK_COLUMNS, toLoginLinkView } from "../../../../helpers/loginLinks";
import { schema, OutputType } from "./revoke_POST.schema";

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/*
 * Stops a sign-in link from working. Sessions already started with it stay signed in; suspend
 * the account to end those.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const { id } = schema.parse(superjson.parse(await request.text()));

    await db
      .updateTable("adminLoginLinks")
      .set({ revokedAt: new Date(), revokedBy: admin.fullName })
      .where("id", "=", id)
      .where("revokedAt", "is", null)
      .execute();

    const row = await db
      .selectFrom("adminLoginLinks")
      .select([...LOGIN_LINK_COLUMNS])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return json({ error: "Link not found." }, 404);

    return json({ link: toLoginLinkView(row) } satisfies OutputType);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Invalid link." }, 400);
    console.error("Error revoking sign-in link:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status =
      error instanceof Error && error.name === "ForbiddenError"
        ? 403
        : error instanceof Error && error.name === "NotAuthenticatedError"
          ? 401
          : 500;
    return json({ error: message }, status);
  }
}