import { db } from "./db";
import { allAccounts } from "./allAccounts";

/**
 * Teachers get the student's contact details with every live class, so a student books a
 * 1:1 trial, a 1:1 package or a live course (group classes) only once both the email address
 * and the mobile number on the account are verified. Returns the reason the booking is
 * refused, or null when it may go ahead. Classes already paid for (package credits) are
 * scheduled without this check.
 */
export async function liveBookingContactProblem(userId: number): Promise<string | null> {
  const row = await db
    .selectFrom(allAccounts(db).as("account"))
    .select(["email", "emailVerified", "mobileNumber", "mobileVerified"])
    .where("id", "=", userId)
    .executeTakeFirst();
  const emailOk = !!row?.email && row.emailVerified;
  const mobileOk = !!row?.mobileNumber && row.mobileVerified;
  if (emailOk && mobileOk) return null;
  if (!emailOk && !mobileOk) return "Verify your email address and mobile number before booking a live class.";
  return emailOk
    ? "Verify your mobile number before booking a live class."
    : "Verify your email address before booking a live class.";
}
