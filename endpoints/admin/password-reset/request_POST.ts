import { randomBytes } from "crypto";
import { sql } from "kysely";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import { getBrandedEmailHtml } from "../../../helpers/emailBaseTemplate";
import { getClientIp } from "../../../helpers/getClientIp";
import { hashAdminResetToken } from "../../../helpers/hashAdminResetToken";
import { sendEmail } from "../../../helpers/sendEmail";
import { SITE_ORIGIN } from "../../../helpers/shareLinks";
import { schema, OutputType } from "./request_POST.schema";

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_LINKS_PER_HOUR = 3;
// Unknown addresses send no mail and return fast, so every response is padded to this floor.
const MIN_RESPONSE_MS = 1500;

async function issueResetLink(email: string, requestedIp: string | null) {
  const admin = await db
    .selectFrom("admins")
    .select(["id", "email", "isActive"])
    .where(sql`lower(email)`, "=", email)
    .executeTakeFirst();

  if (!admin?.isActive) {
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  const issued = await db.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`admin-reset:${admin.id}`}, 0))`.execute(trx);

    const recent = await trx
      .selectFrom("adminPasswordResets")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("adminId", "=", admin.id)
      .where("createdAt", ">", new Date(now.getTime() - ONE_HOUR_MS))
      .executeTakeFirst();

    if (Number(recent?.count ?? 0) >= MAX_LINKS_PER_HOUR) {
      return false;
    }

    // Only the newest link stays usable.
    await trx
      .updateTable("adminPasswordResets")
      .set({ expiresAt: now })
      .where("adminId", "=", admin.id)
      .where("usedAt", "is", null)
      .where("expiresAt", ">", now)
      .execute();

    await trx
      .insertInto("adminPasswordResets")
      .values({
        adminId: admin.id,
        tokenHash: hashAdminResetToken(token),
        expiresAt: new Date(now.getTime() + ONE_HOUR_MS),
        requestedIp,
      })
      .execute();

    return true;
  });

  if (!issued) {
    return;
  }

  // A fragment, not a query string, so the token never reaches server logs, analytics or a Referer header.
  const resetUrl = `${SITE_ORIGIN}/admin/reset-password#token=${token}`;
  const subject = "Reset your Testkart admin password";

  const result = await sendEmail({
    to: admin.email,
    subject,
    html: getBrandedEmailHtml({
      title: subject,
      preheaderText: "This link works once and expires in 1 hour.",
      heading: "Reset your admin password",
      bodyHtml: `
        <p style="margin:0 0 12px;">We received a request to reset the password for your Testkart admin account. The button below works once and expires in 1 hour.</p>
        <p style="margin:0;">If you did not ask for this, ignore this email. Your password stays the same.</p>
      `,
      ctaLabel: "Set a new password",
      ctaUrl: resetUrl,
    }),
    text: `Reset your Testkart admin password: ${resetUrl}\n\nThis link works once and expires in 1 hour. If you did not ask for this, ignore this email.`,
  });

  if (!result.success) {
    console.error(`Admin password reset email failed for admin ${admin.id}:`, result.error);
  }
}

export async function handle(request: Request) {
  const startedAt = Date.now();

  let email: string;
  try {
    email = schema.parse(superjson.parse(await request.text())).email.toLowerCase();
  } catch (error) {
    const message = error instanceof ZodError ? error.errors[0]?.message : undefined;
    return new Response(
      superjson.stringify({ error: message ?? "Enter a valid email address" }),
      { status: 400 }
    );
  }

  // Logged, not returned: an error that only happens for real accounts would reveal them.
  try {
    await issueResetLink(email, getClientIp(request));
  } catch (error) {
    console.error("Admin password reset request failed:", error);
  }

  const wait = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  return new Response(superjson.stringify({ success: true } satisfies OutputType));
}