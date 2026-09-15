import { hash } from "bcryptjs";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import { hashAdminResetToken } from "../../../helpers/hashAdminResetToken";
import { schema, InputType, OutputType } from "./confirm_POST.schema";

function errorResponse(error: string, status: number) {
  return new Response(superjson.stringify({ error }), { status });
}

export async function handle(request: Request) {
  let input: InputType;
  try {
    input = schema.parse(superjson.parse(await request.text()));
  } catch (error) {
    const message = error instanceof ZodError ? error.errors[0]?.message : undefined;
    return errorResponse(message ?? "Invalid reset request", 400);
  }

  try {
    const passwordHash = await hash(input.password, 10);
    const now = new Date();

    const reset = await db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom("adminPasswordResets")
        .innerJoin("admins", "admins.id", "adminPasswordResets.adminId")
        .select([
          "adminPasswordResets.id",
          "adminPasswordResets.adminId",
          "adminPasswordResets.expiresAt",
          "adminPasswordResets.usedAt",
          "admins.email",
          "admins.isActive",
        ])
        .where("adminPasswordResets.tokenHash", "=", hashAdminResetToken(input.token))
        .forUpdate()
        .executeTakeFirst();

      if (!row || row.usedAt || new Date(row.expiresAt) <= now || !row.isActive) {
        return null;
      }

      // sessionInvalidatedAt ends every admin session issued before now.
      await trx
        .updateTable("admins")
        .set({ passwordHash, sessionInvalidatedAt: now, updatedAt: now })
        .where("id", "=", row.adminId)
        .execute();

      await trx
        .updateTable("adminPasswordResets")
        .set({ usedAt: now })
        .where("id", "=", row.id)
        .execute();

      await trx
        .updateTable("adminPasswordResets")
        .set({ expiresAt: now })
        .where("adminId", "=", row.adminId)
        .where("usedAt", "is", null)
        .where("expiresAt", ">", now)
        .execute();

      await trx
        .updateTable("mcpOauthTokens")
        .set({ revokedAt: now })
        .where("adminId", "=", row.adminId)
        .where("revokedAt", "is", null)
        .execute();

      await trx
        .deleteFrom("adminLoginFailures")
        .where("email", "=", row.email.toLowerCase())
        .execute();

      return row;
    });

    if (!reset) {
      return errorResponse("This reset link is invalid or has expired. Request a new one.", 400);
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Admin password reset failed:", error);
    return errorResponse("Could not reset your password. Try again in a moment.", 500);
  }
}