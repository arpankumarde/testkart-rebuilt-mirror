import { z } from "zod";
import superjson from "superjson";
import { schema, OutputType } from "./send-otp_POST.schema";
import { db } from "../../../helpers/db";
import { sendEmail } from "../../../helpers/sendEmail";
import { getBrandedEmailHtml } from "../../../helpers/emailBaseTemplate";
import { getClientIp } from "../../../helpers/getClientIp";
import { verifyTurnstileToken } from "../../../helpers/verifyTurnstileToken";

const OTP_EXPIRATION_MINUTES = 10;
const MAX_SEND_ATTEMPTS_PER_HOUR = 5;

export async function handle(request: Request): Promise<Response> {
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

    // 1. Check if user already exists
    const existingUser = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    if (existingUser) {
      return new Response(
        superjson.stringify({
          error: "An account with this email address already exists.",
        }),
        { status: 409 }
      );
    }

    // 2. Rate limiting: Check how many OTPs were sent in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count } = await db
      .selectFrom("emailOtps")
      .select(db.fn.count("id").as("count"))
      .where("email", "=", email)
      .where("createdAt", ">", oneHourAgo)
      .executeTakeFirstOrThrow();

    if (Number(count) >= MAX_SEND_ATTEMPTS_PER_HOUR) {
      return new Response(
        superjson.stringify({
          error: "Too many OTP requests. Please try again later.",
        }),
        { status: 429 }
      );
    }

    // 3. Generate and store OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000
    );

    await db
      .insertInto("emailOtps")
      .values({
        email,
        otpCode,
        expiresAt,
        userId: null, // Null for signup
      })
      .execute();

    // 4. Send OTP via Email
    const htmlContent = getBrandedEmailHtml({
      title: "Your Testkart Signup Verification Code",
      icon: "🔒",
      heading: "Verify your email",
      subheading: "Use this code to finish signing up for Testkart.",
      bodyHtml: `<p style="margin:0;">Your verification code to sign up for Testkart is below. This code will expire in ${OTP_EXPIRATION_MINUTES} minutes. If you didn't request this code, you can safely ignore this email.</p>`,
      codeBlock: otpCode,
    });

    const emailSent = await sendEmail({
      to: email,
      subject: `Your Testkart Signup Verification Code: ${otpCode}`,
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
        message: "OTP sent successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error in send-email-otp endpoint:", error);
    if (error instanceof z.ZodError) {
      return new Response(superjson.stringify({ error: error.errors }), {
        status: 400,
      });
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}