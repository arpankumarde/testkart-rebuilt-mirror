import { z } from "zod";
import superjson from "superjson";
import { schema } from "./send-otp_POST.schema";
import { db } from "../../../helpers/db";
import { sendEmail } from "../../../helpers/sendEmail";
import { getBrandedEmailHtml } from "../../../helpers/emailBaseTemplate";
import { getClientIp } from "../../../helpers/getClientIp";
import { verifyTurnstileToken } from "../../../helpers/verifyTurnstileToken";

const OTP_EXPIRATION_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email, turnstileToken } = schema.parse(json);

    // 0. Turnstile challenge - the same bot check the SMS OTP routes use.
    // No-ops if TURNSTILE_SECRET_KEY isn't configured.
    const turnstileResult = await verifyTurnstileToken(
      turnstileToken,
      getClientIp(request)
    );
    if (turnstileResult.status === "invalid") {
      return new Response(
        superjson.stringify({ error: "Verification failed. Please try again." }),
        { status: 403 }
      );
    }

    // 1. Check if a user exists with this email (optional - not required for signup)
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .where("emailVerified", "=", true)
      .executeTakeFirst();

    // 2. Rate limiting: Check existing OTP records
    const existingOtp = await db
      .selectFrom("emailOtps")
      .select(["expiresAt", "attempts"])
      .where("email", "=", email)
      .where("verifiedAt", "is", null)
      .orderBy("createdAt", "desc")
      .executeTakeFirst();

    if (existingOtp) {
      if (new Date() < new Date(existingOtp.expiresAt) && existingOtp.attempts >= MAX_ATTEMPTS) {
        return new Response(
          superjson.stringify({
            error: "Too many attempts. Please try again later.",
          }),
          { status: 429 }
        );
      }
    }

    // 3. Generate and store new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    await db
      .insertInto("emailOtps")
      .values({
        userId: user?.id ?? null, // null if no user exists (for signup flow)
        email,
        otpCode, // In a real app, this should be hashed
        expiresAt,
        attempts: 0,
      })
      .execute();

    // 4. Send OTP via Email
    const htmlContent = getBrandedEmailHtml({
      title: "Your Testkart Verification Code",
      icon: "🔒",
      heading: "Verify it's you",
      subheading: "Use this code to log in to Testkart.",
      bodyHtml: `<p style="margin:0;">Your verification code for Testkart is below. This code will expire in ${OTP_EXPIRATION_MINUTES} minutes. If you didn't request this code, you can safely ignore this email.</p>`,
      codeBlock: otpCode,
    });

    const emailSent = await sendEmail({
      to: email,
      subject: `Your Testkart Verification Code: ${otpCode}`,
      html: htmlContent,
      text: `Your Testkart verification code is: ${otpCode}. This code will expire in ${OTP_EXPIRATION_MINUTES} minutes.`,
    });

    if (!emailSent.success) {
      console.error(`Failed to send email OTP to ${email}`, emailSent.error);
      return new Response(
        superjson.stringify({
          error: "Failed to send OTP email. Please try again.",
        }),
        { status: 500 }
      );
    }

    return new Response(
      superjson.stringify({
        success: true,
        message: `OTP sent to ${email}`,
      })
    );
  } catch (error) {
    console.error("Error sending email OTP:", error);
    if (error instanceof z.ZodError) {
      return new Response(superjson.stringify({ error: error.errors }), {
        status: 400,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}