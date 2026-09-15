import { schema, OutputType } from "./verify_otp_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { sql } from "kysely";

const MAX_ATTEMPTS = 5;

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
    const { mobileNumber, otpCode } = schema.parse(json);

    const normalizedMobile = normalizeMobileNumber(mobileNumber);

    const latestOtp = await db.selectFrom('mobileOtps')
      .selectAll()
      .where('userId', '=', user.id)
      .where('mobileNumber', '=', normalizedMobile)
      .where('verifiedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!latestOtp) {
      return new Response(superjson.stringify({ error: "No pending OTP found for this number. Please request a new one." }), { status: 404 });
    }

    if (latestOtp.attempts >= MAX_ATTEMPTS) {
      return new Response(superjson.stringify({ error: "Maximum verification attempts reached. Please request a new OTP." }), { status: 429 });
    }

    if (new Date() > new Date(latestOtp.expiresAt)) {
      return new Response(superjson.stringify({ error: "OTP has expired. Please request a new one." }), { status: 410 });
    }

        if (latestOtp.otpCode !== otpCode) {
      await db.updateTable('mobileOtps')
        .set({ attempts: sql`${sql.ref('attempts')} + 1` })
        .where('id', '=', latestOtp.id)
        .execute();
      return new Response(superjson.stringify({ error: "Invalid OTP code." }), { status: 400 });
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

    // OTP is correct, update user and OTP entry
    await db.transaction().execute(async (trx) => {
      await trx.updateTable('users')
        .set({
          mobileNumber: normalizedMobile,
          mobileVerified: true,
          updatedAt: new Date(),
        })
        .where('id', '=', user.id)
        .execute();

      await trx.updateTable('mobileOtps')
        .set({ verifiedAt: new Date() })
        .where('id', '=', latestOtp.id)
        .execute();
    });

    return new Response(superjson.stringify({ success: true, message: "Mobile number verified successfully." } satisfies OutputType));

  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated." }), { status: 401 });
    }
    if (error instanceof Error) {
      console.error("Error in verify_otp_POST:", error);
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred." }), { status: 500 });
  }
}