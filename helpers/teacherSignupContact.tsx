import { db } from "./db";

/**
 * New teachers must give both an email and a mobile number at signup. The OTP
 * verifies one of them; the other is stored unverified. Enforced here rather
 * than in the database so existing accounts and student signups are untouched.
 * Returns an error message, or null when the second contact is acceptable.
 */
export async function checkTeacherSecondContact(
  role: string,
  field: "email" | "mobileNumber",
  value: string | undefined
): Promise<string | null> {
  if (role !== "teacher") return null;

  if (!value) {
    return field === "email"
      ? "Email address is required to create a teacher account."
      : "Mobile number is required to create a teacher account.";
  }

  const existing = await db
    .selectFrom("users")
    .select("id")
    .where(field, "=", value)
    .executeTakeFirst();

  if (existing) {
    return field === "email"
      ? "An account with this email address already exists."
      : "An account with this mobile number already exists.";
  }

  return null;
}