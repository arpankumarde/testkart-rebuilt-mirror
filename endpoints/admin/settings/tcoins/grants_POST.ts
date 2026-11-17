import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { schema, OutputType } from "./grants_POST.schema";

const MAX_DAYS_AHEAD = 3650;

/** Gives one student coins that expire at the end of the chosen day, India time. */
export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const expiresAt = new Date(`${input.expiresOn}T23:59:59.999+05:30`);
    const now = Date.now();
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now) {
      throw new Error("Pick an expiry date from today onwards.");
    }
    if (expiresAt.getTime() > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
      throw new Error("Expiry can be at most 10 years away.");
    }

    const lookup = input.student.trim();
    const digits = lookup.replace(/\D/g, "");
    const isEmail = lookup.includes("@");
    if (!isEmail && digits.length < 10) {
      throw new Error("Enter the student's email address or 10-digit mobile number.");
    }
    const students = await db
      .selectFrom("students")
      .select(["id", "displayName", "email"])
      .where(
        isEmail
          ? sql<boolean>`lower(email) = ${lookup.toLowerCase()}`
          : sql<boolean>`right(regexp_replace(coalesce(mobile_number, ''), '[^0-9]', '', 'g'), 10) = ${digits.slice(-10)}`
      )
      .limit(2)
      .execute();
    if (students.length === 0) throw new Error("No student account matches that email or mobile number.");
    if (students.length > 1) throw new Error("More than one student has that mobile number. Use their email instead.");
    const student = students[0];

    const grant = await db
      .insertInto("tcoinGrants")
      .values({
        userId: student.id,
        coins: input.coins,
        reason: input.reason || null,
        grantedBy: admin.fullName,
        expiresAt,
      })
      .returning(["id", "coins", "expiresAt"])
      .executeTakeFirstOrThrow();

    console.log(`Admin ${admin.id} granted ${grant.coins} Tcoins to user ${student.id}, expiring ${expiresAt.toISOString()}`);
    return new Response(
      superjson.stringify({
        grant: { ...grant, studentName: student.displayName, studentEmail: student.email },
      } satisfies OutputType)
    );
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Could not grant Tcoins" }),
      { status: 400 }
    );
  }
}