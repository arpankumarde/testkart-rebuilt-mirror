import { schema, OutputType } from "./send-email-otp_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sendEmail } from "../../helpers/sendEmail";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { getBrandedEmailHtml } from "../../helpers/emailBaseTemplate";
import { checkEmailOtpRateLimit } from "../../helpers/otpRateLimit";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getEmailHtml(otpCode: string): string {
  return getBrandedEmailHtml({
    title: "Verify your email - Testkart",
    icon: "🔒",
    heading: "Verify your email address",
    subheading: "Enter this code to confirm it's you.",
    bodyHtml: `<p style="margin:0;">Please use the following 6-digit code to verify your email address. This code is valid for 10 minutes. If you did not request this code, you can safely ignore this email.</p>`,
    codeBlock: otpCode,
  });
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { email } = schema.parse(json);

    const normalizedEmail = email.toLowerCase().trim();

    // Check if another user already has this email
    const existingUser = await db.selectFrom('users')
      .select('id')
      .where('email', '=', normalizedEmail)
      .where('id', '!=', user.id)
      .limit(1)
      .executeTakeFirst();

    if (existingUser) {
      return new Response(superjson.stringify({ error: "This email address is already linked to another account." }), { status: 409 });
    }

    const rateLimitResult = await checkEmailOtpRateLimit(db, {
      email: normalizedEmail,
      userId: user.id,
    });
    if (!rateLimitResult.allowed) {
      return new Response(superjson.stringify({ error: rateLimitResult.message }), { status: 429 });
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await db.insertInto('emailOtps').values({
      userId: user.id,
      email: normalizedEmail,
      otpCode,
      expiresAt,
    }).execute();

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: "Verify your email - Testkart",
      html: getEmailHtml(otpCode),
      text: `Your Testkart email verification code is: ${otpCode}`,
    });

    if (!emailResult.success) {
      console.error(`Failed to send email OTP to ${normalizedEmail} for user ${user.id}`, emailResult.error);
      return new Response(superjson.stringify({ error: "Failed to send verification email. Please try again later." }), { status: 500 });
    }

    return new Response(superjson.stringify({ success: true, message: "Verification email sent successfully." } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated." }), { status: 401 });
    }
    if (error instanceof Error) {
      console.error("Error in send-email-otp_POST:", error);
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred." }), { status: 500 });
  }
}