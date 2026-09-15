import { z } from "zod";
import superjson from "superjson";
import { schema, OutputType } from "./send-otp_POST.schema";
import { db } from "../../../helpers/db";
import { sendSMS } from "../../../helpers/sendSMS";
import { getClientIp } from "../../../helpers/getClientIp";
import { checkOtpRateLimit } from "../../../helpers/otpRateLimit";
import { verifyTurnstileToken } from "../../../helpers/verifyTurnstileToken";
import { generateOtpCode } from "../../../helpers/otpVerifyGuard";

const OTP_EXPIRATION_MINUTES = 10;

export async function handle(request: Request): Promise<Response> {
  try {
    const json = superjson.parse(await request.text());
    const { mobileNumber, turnstileToken } = schema.parse(json);
    const ipAddress = getClientIp(request);

    // 0. Turnstile challenge — the primary defense against the automated
    // SMS-pumping abuse (large rotating pool of numbers/IPs that stayed
    // under the per-number/per-IP caps below). No-ops if
    // TURNSTILE_SECRET_KEY isn't configured yet.
    const turnstileResult = await verifyTurnstileToken(turnstileToken, ipAddress);
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
      .where("mobileNumber", "=", mobileNumber)
      .executeTakeFirst();

    if (existingUser) {
      return new Response(
        superjson.stringify({
          error: "An account with this mobile number already exists.",
        }),
        { status: 409 }
      );
    }

    // 2. Rate limiting: per-number cooldown/caps and per-IP caps. Every send
    // that clears this check triggers a real, billed SMS, so this is the
    // primary defense against OTP-pumping abuse.
    const rateLimitResult = await checkOtpRateLimit(db, { mobileNumber, ipAddress });
    if (!rateLimitResult.allowed) {
      return new Response(
        superjson.stringify({ error: rateLimitResult.message }),
        { status: 429 }
      );
    }

    // 3. Generate and store OTP
    const otpCode = generateOtpCode(4);
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000
    );

    await db
      .insertInto("mobileOtps")
      .values({
        mobileNumber,
        otpCode,
        expiresAt,
        userId: null, // Null for signup
        ipAddress,
      })
      .execute();

    // 4. Send OTP via SMS
    const smsSent = await sendSMS(mobileNumber, otpCode);

    if (!smsSent) {
      console.error(`Failed to send OTP to ${mobileNumber}`);
      return new Response(
        superjson.stringify({
          error: "Failed to send OTP. Please try again.",
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
    console.error("Error in send-otp endpoint:", error);
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