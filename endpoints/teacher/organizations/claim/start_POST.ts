import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getClientIp } from "../../../../helpers/getClientIp";
import { sendSMS } from "../../../../helpers/sendSMS";
import { sendEmail } from "../../../../helpers/sendEmail";
import { generateOtpCode } from "../../../../helpers/otpVerifyGuard";
import { maskEmail, maskPhone, parseContactEmails, CLAIM_OTP_EXPIRATION_MINUTES } from "../../../../helpers/organizationClaim";
import { schema, OutputType } from "./start_POST.schema";
import superjson from "superjson";

const COOLDOWN_SECONDS = 45;
const MAX_PER_ORG_PER_DAY = 6;
const MAX_PER_TEACHER_PER_DAY = 10;

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teacher accounts can claim an organisation." }), {
        status: 403,
      });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    const ipAddress = getClientIp(request);

    const org = await db
      .selectFrom("organizations")
      .select(["id", "claimStatus", "phoneNumber", "contactEmails"])
      .where("id", "=", input.organizationId)
      .executeTakeFirst();

    if (!org) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }
    if (org.claimStatus === "claimed") {
      return new Response(superjson.stringify({ error: "This organisation has already been claimed." }), {
        status: 409,
      });
    }

    // The contact value must be EXACTLY one of the organisation's own
    // scraped contacts - never something the teacher supplied themselves.
    const validEmails = parseContactEmails(org.contactEmails);
    const isValidContact =
      (input.method === "phone" && org.phoneNumber && org.phoneNumber === input.contactValue) ||
      (input.method === "email" && validEmails.includes(input.contactValue));

    if (!isValidContact) {
      return new Response(
        superjson.stringify({ error: "That contact method isn't on file for this organisation." }),
        { status: 400 }
      );
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Cooldown + per-org / per-teacher daily caps. Every allowed call here
    // sends a real SMS or email, so this is the actual abuse defense.
    const lastForOrg = await db
      .selectFrom("organizationClaimRequests")
      .select("createdAt")
      .where("organizationId", "=", org.id)
      .orderBy("createdAt", "desc")
      .executeTakeFirst();

    if (lastForOrg) {
      const secondsSinceLast = (now.getTime() - new Date(lastForOrg.createdAt).getTime()) / 1000;
      if (secondsSinceLast < COOLDOWN_SECONDS) {
        const wait = Math.ceil(COOLDOWN_SECONDS - secondsSinceLast);
        return new Response(
          superjson.stringify({ error: `Please wait ${wait} seconds before requesting another code.` }),
          { status: 429 }
        );
      }
    }

    const [{ count: orgDayCount }] = await db
      .selectFrom("organizationClaimRequests")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("organizationId", "=", org.id)
      .where("createdAt", ">=", oneDayAgo)
      .execute();
    if (Number(orgDayCount ?? 0) >= MAX_PER_ORG_PER_DAY) {
      return new Response(
        superjson.stringify({ error: "Too many claim attempts for this organisation today. Please try again tomorrow." }),
        { status: 429 }
      );
    }

    const [{ count: teacherDayCount }] = await db
      .selectFrom("organizationClaimRequests")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("teacherId", "=", effectiveTeacherId)
      .where("createdAt", ">=", oneDayAgo)
      .execute();
    if (Number(teacherDayCount ?? 0) >= MAX_PER_TEACHER_PER_DAY) {
      return new Response(
        superjson.stringify({ error: "Too many claim attempts from your account today. Please try again tomorrow." }),
        { status: 429 }
      );
    }

    const otpCode = generateOtpCode(6);
    const expiresAt = new Date(now.getTime() + CLAIM_OTP_EXPIRATION_MINUTES * 60 * 1000);

    if (input.method === "phone") {
      const smsSent = await sendSMS(input.contactValue, otpCode);
      if (!smsSent) {
        return new Response(superjson.stringify({ error: "Failed to send the verification code. Please try again." }), {
          status: 500,
        });
      }
    } else {
      const emailResult = await sendEmail({
        to: input.contactValue,
        subject: "Verify you own this organisation on Testkart",
        html: `<p>Your verification code is <strong>${otpCode}</strong>.</p><p>It expires in ${CLAIM_OTP_EXPIRATION_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>`,
        text: `Your verification code is ${otpCode}. It expires in ${CLAIM_OTP_EXPIRATION_MINUTES} minutes.`,
      });
      if (!emailResult.success) {
        return new Response(superjson.stringify({ error: "Failed to send the verification code. Please try again." }), {
          status: 500,
        });
      }
    }

    await db
      .insertInto("organizationClaimRequests")
      .values({
        organizationId: org.id,
        teacherId: effectiveTeacherId,
        method: input.method,
        contactValue: input.contactValue,
        otpCode,
        attempts: 0,
        status: "pending",
        ipAddress,
        expiresAt,
      })
      .execute();

    await db
      .updateTable("organizations")
      .set({ claimStatus: "pending_verification" })
      .where("id", "=", org.id)
      .where("claimStatus", "=", "unclaimed")
      .execute();

    const masked = input.method === "phone" ? maskPhone(input.contactValue) : maskEmail(input.contactValue);

    return new Response(
      superjson.stringify({
        success: true,
        maskedDestination: masked,
        expiresInMinutes: CLAIM_OTP_EXPIRATION_MINUTES,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to start organisation claim:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
