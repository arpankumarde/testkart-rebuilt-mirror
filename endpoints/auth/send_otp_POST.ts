import { schema, OutputType } from "./send_otp_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sendSMS } from "../../helpers/sendSMS";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { getClientIp } from "../../helpers/getClientIp";
import { checkOtpRateLimit } from "../../helpers/otpRateLimit";

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function normalizeMobileNumber(mobile: string): string {
  const digitsOnly = mobile.replace(/\D/g, '');
  if (digitsOnly.length > 10) {
    return digitsOnly.slice(-10);
  }
  return digitsOnly;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { mobileNumber } = schema.parse(json);

    const normalizedMobile = normalizeMobileNumber(mobileNumber);
    if (normalizedMobile.length !== 10) {
      return new Response(superjson.stringify({ error: "Invalid mobile number format. Must be 10 digits." }), { status: 400 });
    }

    // Check if another verified user already has this mobile number
    const existingUser = await db.selectFrom('users')
      .select('id')
      .where('mobileNumber', '=', normalizedMobile)
      .where('mobileVerified', '=', true)
      .where('id', '!=', user.id)
      .limit(1)
      .executeTakeFirst();

    if (existingUser) {
      return new Response(superjson.stringify({ error: "This mobile number is already linked to another account. Please use a different number." }), { status: 409 });
    }

    const ipAddress = getClientIp(request);
    const rateLimitResult = await checkOtpRateLimit(db, {
      mobileNumber: normalizedMobile,
      ipAddress,
      userId: user.id,
    });
    if (!rateLimitResult.allowed) {
      return new Response(superjson.stringify({ error: rateLimitResult.message }), { status: 429 });
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await db.insertInto('mobileOtps').values({
      userId: user.id,
      mobileNumber: normalizedMobile,
      otpCode,
      expiresAt,
      ipAddress,
    }).execute();

    const smsSent = await sendSMS(normalizedMobile, otpCode);

    if (!smsSent) {
      console.error(`Failed to send OTP to ${normalizedMobile} for user ${user.id}`);
      return new Response(superjson.stringify({ error: "Failed to send OTP. Please try again later." }), { status: 500 });
    }

    return new Response(superjson.stringify({ success: true, message: "OTP sent successfully." } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated." }), { status: 401 });
    }
    if (error instanceof Error) {
      console.error("Error in send_otp_POST:", error);
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred." }), { status: 500 });
  }
}