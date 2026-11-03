import { z } from "zod";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { LOGIN_LINK_COLUMNS, toLoginLinkView } from "../../../../helpers/loginLinks";
import { schema, OutputType } from "./list_GET.schema";

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/* The 10 most recent sign-in links for one user, newest first. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const { userId } = schema.parse({ userId: Number(url.searchParams.get("userId")) });

    const rows = await db
      .selectFrom("adminLoginLinks")
      .select([...LOGIN_LINK_COLUMNS])
      .where("userId", "=", userId)
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(10)
      .execute();

    return json({ links: rows.map(toLoginLinkView) } satisfies OutputType);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Invalid user." }, 400);
    console.error("Error listing sign-in links:", error);
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