import { z } from "zod";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { getAccountStatus } from "../../../../helpers/accountStatus";
import { LOGIN_LINK_COLUMNS, toLoginLinkView } from "../../../../helpers/loginLinks";
import { createLoginLinkToken, hashLoginLinkToken } from "../../../../helpers/loginLinkToken";
import { schema, OutputType } from "./create_POST.schema";

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/*
 * Creates a temporary sign-in link for a student or teacher. Opening it signs that browser in
 * as the user with an ordinary session (not impersonation). Admin accounts and suspended or
 * banned users are refused.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const target = await db
      .selectFrom("users")
      .select(["id", "role", "isActive", "suspensionKind", "suspendedUntil"])
      .where("id", "=", input.userId)
      .executeTakeFirst();

    if (!target) return json({ error: "User not found." }, 404);
    if (target.role === "admin") {
      return json({ error: "Sign-in links cannot be made for admin accounts." }, 400);
    }
    if (getAccountStatus(target) !== "active") {
      return json({ error: "This account is suspended or banned. Reactivate it first." }, 400);
    }

    const token = createLoginLinkToken();
    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60 * 1000);

    const row = await db
      .insertInto("adminLoginLinks")
      .values({
        userId: target.id,
        tokenHash: hashLoginLinkToken(token),
        expiresAt,
        singleUse: input.singleUse,
        note: input.note || null,
        createdBy: admin.fullName,
      })
      .returning([...LOGIN_LINK_COLUMNS])
      .executeTakeFirstOrThrow();

    console.log(`Admin ${admin.id} created sign-in link ${row.id} for user ${target.id}`);

    return json({ link: toLoginLinkView(row), token } satisfies OutputType);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ error: error.errors.map((e) => e.message).join(" ") }, 400);
    }
    console.error("Error creating sign-in link:", error);
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