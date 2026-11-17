import { schema, OutputType } from "./send-email-otp_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { allAccounts } from "../../helpers/allAccounts";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sendEmail } from "../../helpers/sendEmail";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { getBrandedEmailHtml } from "../../helpers/emailBaseTemplate";
import { checkEmailOtpRateLimit } from "../../helpers/otpRateLimit";
import { generateOtpCode } from "../../helpers/otpVerifyGuard";

function generateOtp(): string {
  return generateOtpCode(6);
}

function getEmailHtml(otpCode: string, isStudent: boolean): string {
  return getBrandedEmailHtml({
    title: "Your Testkart OTP",
    preheaderText: "This OTP expires in 10 minutes.",
    icon: "🔒",
    eyebrow: "OTP",
    heading: "Your email OTP",
    bodyHtml: `<p style="margin:0;">Enter this OTP to confirm this email address. It expires in 10 minutes.</p>`,
    codeBlock: otpCode,
    afterCtaHtml: `<p style="margin:0;">Didn't ask for this? You can ignore this email.</p>`,
    studentAppPromo: isStudent,
  });
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { email } = schema.parse(json);

    const normalizedEmail = email.toLowerCase().trim();

    // Check if another user already has this email
    const existingUser = await db.selectFrom(allAccounts(db).as('users'))
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
      subject: `Your Testkart OTP: ${otpCode}`,
      html: getEmailHtml(otpCode, user.role === "student"),
      text: `Your Testkart OTP is: ${otpCode}. It expires in 10 minutes.`,
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