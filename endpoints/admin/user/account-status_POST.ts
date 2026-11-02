import { z } from "zod";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { sendTemplateEmail } from "../../../helpers/sendTemplateEmail";
import { formatIstDateTime, getAccountStatus, type SuspensionKind } from "../../../helpers/accountStatus";
import { schema, OutputType } from "./account-status_POST.schema";

const DAY_MS = 24 * 60 * 60 * 1000;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/*
 * Suspends (for a number of days or until lifted), bans or reactivates a student or teacher.
 * Suspending or banning signs the user out everywhere; helpers/getServerUserSession and the
 * login endpoints keep them out (helpers/accountSuspension). Every change is logged in
 * user_account_actions, and the user is emailed after the change is saved.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const target = await db
      .selectFrom("users")
      .select(["id", "email", "displayName", "role", "isActive", "suspensionKind", "suspendedUntil"])
      .where("id", "=", input.userId)
      .executeTakeFirst();

    if (!target) return json({ error: "User not found." }, 404);
    if (target.role === "admin") {
      return json({ error: "Admin accounts are managed under Admins and access." }, 400);
    }

    const previousStatus = getAccountStatus(target);
    const now = new Date();
    let kind: SuspensionKind | null = null;
    let suspendedUntil: Date | null = null;

    await db.transaction().execute(async (trx) => {
      if (input.action === "reactivate") {
        await trx
          .updateTable("users")
          .set({
            isActive: true,
            suspensionKind: null,
            suspendedUntil: null,
            suspensionReason: null,
            suspendedAt: null,
            suspendedBy: null,
            updatedAt: now,
          })
          .where("id", "=", target.id)
          .execute();
        await trx
          .insertInto("userAccountActions")
          .values({ userId: target.id, action: "reactivated", reason: input.note || null, adminName: admin.fullName })
          .execute();
        return;
      }

      kind = input.action === "ban" ? "banned" : "suspended";
      suspendedUntil =
        input.action === "suspend" && input.durationDays ? new Date(now.getTime() + input.durationDays * DAY_MS) : null;

      await trx
        .updateTable("users")
        .set({
          isActive: false,
          suspensionKind: kind,
          suspendedUntil,
          suspensionReason: input.reason,
          suspendedAt: now,
          suspendedBy: admin.fullName,
          updatedAt: now,
        })
        .where("id", "=", target.id)
        .execute();
      await trx
        .insertInto("userAccountActions")
        .values({
          userId: target.id,
          action: kind,
          reason: input.reason,
          suspendedUntil,
          adminName: admin.fullName,
        })
        .execute();
      await trx
        .deleteFrom("sessions")
        .where("userId", "=", target.id)
        .where("impersonatorAdminId", "is", null)
        .execute();
    });

    let emailSent = false;
    if (target.email) {
      const displayName = escapeHtml(target.displayName);
      const options = { studentAppPromo: false };
      if (input.action === "reactivate") {
        if (previousStatus !== "active") {
          const result = await sendTemplateEmail("account_reactivated", target.email, { displayName }, options);
          emailSent = result.success;
        }
      } else {
        const banned = kind === "banned";
        const statusLine = banned
          ? "Your Testkart account has been permanently banned."
          : suspendedUntil
            ? `Your Testkart account is suspended until ${formatIstDateTime(suspendedUntil)}.`
            : "Your Testkart account is suspended until we finish reviewing it.";
        const result = await sendTemplateEmail(
          "account_suspended",
          target.email,
          {
            displayName,
            actionPast: banned ? "banned" : "suspended",
            actionTitle: banned ? "Account banned" : "Account suspended",
            statusLine,
            reason: escapeHtml(input.reason).replace(/\n/g, "<br>"),
            reasonText: input.reason,
          },
          options
        );
        emailSent = result.success;
      }
    }

    const output: OutputType = {
      success: true,
      userId: target.id,
      status: input.action === "reactivate" ? "active" : (kind ?? "suspended"),
      suspendedUntil,
      emailSent,
    };
    return json(output);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ error: error.errors.map((e) => e.message).join(" ") }, 400);
    }
    console.error("Error changing account status:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error instanceof Error && error.name === "ForbiddenError" ? 403 : 500;
    return json({ error: message }, status);
  }
}