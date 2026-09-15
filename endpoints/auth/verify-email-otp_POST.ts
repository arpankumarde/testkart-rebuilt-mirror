import { schema, OutputType } from "./verify-email-otp_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { sql } from "kysely";

const MAX_ATTEMPTS = 5;

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { email, otpCode } = schema.parse(json);

    const normalizedEmail = email.toLowerCase().trim();

    const latestOtp = await db.selectFrom('emailOtps')
      .selectAll()
      .where('userId', '=', user.id)
      .where('email', '=', normalizedEmail)
      .where('verifiedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!latestOtp) {
      return new Response(superjson.stringify({ error: "No pending OTP found for this email. Please request a new one." }), { status: 404 });
    }

    if (latestOtp.attempts >= MAX_ATTEMPTS) {
      return new Response(superjson.stringify({ error: "Maximum verification attempts reached. Please request a new OTP." }), { status: 429 });
    }

    if (new Date() > new Date(latestOtp.expiresAt)) {
      return new Response(superjson.stringify({ error: "OTP has expired. Please request a new one." }), { status: 410 });
    }

    if (latestOtp.otpCode !== otpCode) {
      await db.updateTable('emailOtps')
        .set({ attempts: sql`${sql.ref('attempts')} + 1` })
        .where('id', '=', latestOtp.id)
        .execute();
      return new Response(superjson.stringify({ error: "Invalid OTP code." }), { status: 400 });
    }

    // Re-check for duplicate email just in case another user verified it concurrently
    const existingUser = await db.selectFrom('users')
      .select('id')
      .where('email', '=', normalizedEmail)
      .where('id', '!=', user.id)
      .limit(1)
      .executeTakeFirst();

    if (existingUser) {
      return new Response(superjson.stringify({ error: "This email address is already linked to another account." }), { status: 409 });
    }

    // OTP is correct, update user and OTP entry in a transaction
    await db.transaction().execute(async (trx) => {
      await trx.updateTable('users')
        .set({
          email: normalizedEmail,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where('id', '=', user.id)
        .execute();

      await trx.updateTable('emailOtps')
        .set({ verifiedAt: new Date() })
        .where('id', '=', latestOtp.id)
        .execute();
    });

    return new Response(superjson.stringify({ success: true, message: "Email address verified successfully." } satisfies OutputType));

  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated." }), { status: 401 });
    }
    if (error instanceof Error) {
      console.error("Error in verify-email-otp_POST:", error);
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred." }), { status: 500 });
  }
}