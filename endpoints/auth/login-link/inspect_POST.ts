import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getLoginLinkStatus } from "../../../helpers/loginLinks";
import { hashLoginLinkToken, LOGIN_LINK_TOKEN_PATTERN } from "../../../helpers/loginLinkToken";
import { accountBlockedMessage, getAccountStatus } from "../../../helpers/accountStatus";
import { schema, OutputType } from "./inspect_POST.schema";

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const REFUSALS = {
  invalid: "This sign-in link is not valid. Check that you copied all of it, or ask Testkart support for a new one.",
  expired: "This sign-in link has expired. Ask Testkart support for a new one.",
  used: "This sign-in link has already been used. Ask Testkart support for a new one.",
  revoked: "This sign-in link was cancelled. Ask Testkart support for a new one.",
} as const;

/* Says whose account a sign-in link opens, without using it up. */
export async function handle(request: Request): Promise<Response> {
  try {
    const { token } = schema.parse(superjson.parse(await request.text()));
    if (!LOGIN_LINK_TOKEN_PATTERN.test(token)) {
      return json({ valid: false, reason: "invalid", message: REFUSALS.invalid } satisfies OutputType);
    }

    const row = await db
      .selectFrom("adminLoginLinks")
      .innerJoin("users", "users.id", "adminLoginLinks.userId")
      .select([
        "adminLoginLinks.expiresAt",
        "adminLoginLinks.singleUse",
        "adminLoginLinks.useCount",
        "adminLoginLinks.revokedAt",
        "users.displayName",
        "users.role",
        "users.isActive",
        "users.suspensionKind",
        "users.suspendedUntil",
      ])
      .where("adminLoginLinks.tokenHash", "=", hashLoginLinkToken(token))
      .executeTakeFirst();

    if (!row || row.role === "admin") {
      return json({ valid: false, reason: "invalid", message: REFUSALS.invalid } satisfies OutputType);
    }

    const status = getLoginLinkStatus({
      id: 0,
      expiresAt: row.expiresAt,
      singleUse: row.singleUse,
      useCount: row.useCount,
      lastUsedAt: null,
      revokedAt: row.revokedAt,
      revokedBy: null,
      note: null,
      createdBy: "",
      createdAt: row.expiresAt,
    });
    if (status !== "active") {
      return json({ valid: false, reason: status, message: REFUSALS[status] } satisfies OutputType);
    }
    if (getAccountStatus(row) !== "active") {
      return json({ valid: false, reason: "blocked", message: accountBlockedMessage(row) } satisfies OutputType);
    }

    return json({
      valid: true,
      displayName: row.displayName,
      role: row.role === "teacher" ? "teacher" : "student",
      expiresAt: row.expiresAt,
    } satisfies OutputType);
  } catch (error) {
    console.error("Error checking sign-in link:", error);
    return json({ error: "Could not check this link. Try again." }, 500);
  }
}