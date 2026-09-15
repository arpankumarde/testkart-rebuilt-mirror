import { sql } from "kysely";
import { compare, hash } from "bcryptjs";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../helpers/db";
import { getClientIp } from "../../helpers/getClientIp";
import { setAdminServerSession } from "../../helpers/getAdminSession";
import { schema, InputType, OutputType } from "./login_POST.schema";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const FAILURE_RETENTION_MS = 24 * 60 * 60 * 1000;

function errorResponse(error: string, status: number) {
  return new Response(superjson.stringify({ error }), { status });
}

export async function handle(request: Request) {
  let input: InputType;
  try {
    input = schema.parse(superjson.parse(await request.text()));
  } catch (error) {
    const message = error instanceof ZodError ? error.errors[0]?.message : undefined;
    return errorResponse(message ?? "Invalid sign-in request", 400);
  }

  const email = input.email.toLowerCase();
  const now = new Date();

  try {
    const outcome = await db.transaction().execute(async (trx) => {
      // Serializes attempts per address, so parallel guesses cannot all slip under the limit.
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`admin-login:${email}`}, 0))`.execute(trx);

      const recentFailures = await trx
        .selectFrom("adminLoginFailures")
        .select("attemptedAt")
        .where("email", "=", email)
        .where("attemptedAt", ">", new Date(now.getTime() - LOCKOUT_WINDOW_MS))
        .orderBy("attemptedAt", "desc")
        .limit(MAX_FAILED_ATTEMPTS)
        .execute();

      if (recentFailures.length >= MAX_FAILED_ATTEMPTS) {
        const unlocksAt =
          new Date(recentFailures[MAX_FAILED_ATTEMPTS - 1].attemptedAt).getTime() + LOCKOUT_WINDOW_MS;
        return {
          type: "locked" as const,
          minutes: Math.max(1, Math.ceil((unlocksAt - now.getTime()) / 60000)),
        };
      }

      const admin = await trx
        .selectFrom("admins")
        .selectAll()
        .where(sql`lower(email)`, "=", email)
        .executeTakeFirst();

      let passwordValid = false;
      if (admin) {
        passwordValid = await compare(input.password, admin.passwordHash);
      } else {
        // Same bcrypt cost as a real check, so response time does not reveal which emails exist.
        await hash(input.password, 10);
      }

      // Unknown addresses count too, so a lockout does not reveal which emails exist either.
      if (!admin || !passwordValid) {
        await trx
          .insertInto("adminLoginFailures")
          .values({ email, ipAddress: getClientIp(request), attemptedAt: now })
          .execute();
        return { type: "invalid" as const };
      }

      // Reported only after the password matches, so it cannot be used to probe for accounts.
      if (!admin.isActive) {
        return { type: "inactive" as const };
      }

      await trx.deleteFrom("adminLoginFailures").where("email", "=", email).execute();
      await trx.updateTable("admins").set({ lastLoginAt: now }).where("id", "=", admin.id).execute();

      return { type: "success" as const, admin };
    });

    if (Math.random() < 0.05) {
      await db
        .deleteFrom("adminLoginFailures")
        .where("attemptedAt", "<", new Date(now.getTime() - FAILURE_RETENTION_MS))
        .execute()
        .catch((error) => console.error("Admin login failure cleanup failed:", error));
    }

    if (outcome.type === "locked") {
      const unit = outcome.minutes === 1 ? "minute" : "minutes";
      return errorResponse(
        `Too many failed sign-in attempts. Try again in ${outcome.minutes} ${unit}, or reset your password.`,
        429
      );
    }

    if (outcome.type === "invalid") {
      return errorResponse("Invalid email or password", 401);
    }

    if (outcome.type === "inactive") {
      return errorResponse("Your account is inactive. Please contact support.", 403);
    }

    const { admin } = outcome;
    const adminProfile = {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
      avatarFileId: admin.avatarFileId,
      bio: admin.bio,
    };

    const response = new Response(
      superjson.stringify({ admin: adminProfile } satisfies OutputType)
    );

    await setAdminServerSession(response, adminProfile);

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return errorResponse("Could not sign you in. Try again in a moment.", 500);
  }
}