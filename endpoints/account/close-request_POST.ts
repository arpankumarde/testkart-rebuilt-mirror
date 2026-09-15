import { schema, OutputType } from "./close-request_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { clearServerSession, NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { sendTemplateEmail } from "../../helpers/sendTemplateEmail";
import {
  collectStudentCounterTargets,
  syncStudentCounterTargets,
} from "../../helpers/enrollmentCounters";

class AccountNotFoundError extends Error {}

function foreignKeyBlocker(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const { code, constraint_name } = error as { code?: unknown; constraint_name?: unknown };
  if (code !== "23503") return null;
  return typeof constraint_name === "string" ? constraint_name : "unknown constraint";
}

export async function handle(request: Request) {
  let userId: number | null = null;
  try {
    const { user } = await getServerUserSession(request);
    userId = user.id;

    const text = await request.text();
    const json = superjson.parse(text);
    const { reason } = schema.parse(json);

    console.log(`Account closure requested for user ${user.id}`);

    // Every step runs on trx: the db pool has a single connection and the
    // transaction holds it until commit, so a query on db here would hang.
    const { closedUser, counterTargets } = await db.transaction().execute(async (trx) => {
      const fullUser = await trx
        .selectFrom("users")
        .select(["id", "email", "displayName", "mobileNumber", "role", "createdAt"])
        .where("id", "=", user.id)
        .forUpdate()
        .executeTakeFirst();

      if (!fullUser) {
        throw new AccountNotFoundError();
      }

      await trx
        .insertInto("deletedAccounts")
        .values({
          originalUserId: fullUser.id,
          email: fullUser.email ?? null,
          displayName: fullUser.displayName,
          mobileNumber: fullUser.mobileNumber ?? null,
          role: fullUser.role,
          reason: reason ?? null,
          registeredAt: fullUser.createdAt,
        })
        .execute();

      // A teacher's own sponsorship ledger goes with them. Rows where this user
      // was the sponsored student stay so the sponsoring teacher's balance keeps
      // the deduction: the FK nulls student_id and the phone is cleared here.
      await trx
        .deleteFrom("teacherSponsoredEnrollments")
        .where("teacherId", "=", user.id)
        .execute();

      await trx
        .updateTable("teacherSponsoredEnrollments")
        .set({ studentPhone: "" })
        .where("studentId", "=", user.id)
        .execute();

      await trx
        .deleteFrom("sessions")
        .where("userId", "=", user.id)
        .execute();

      // Enrollments and purchases cascade off users, so the counters they feed
      // have to be resolved before the delete. See helpers/enrollmentCounters.tsx.
      const targets = await collectStudentCounterTargets(user.id, trx);

      // Owned content, orders and enrollments cascade; support threads and
      // sponsorship rows are detached (ON DELETE SET NULL). A remaining blocker,
      // such as a test students have bought or an authored blog post, raises
      // 23503 and rolls the whole closure back.
      await trx
        .deleteFrom("users")
        .where("id", "=", user.id)
        .execute();

      return { closedUser: fullUser, counterTargets: targets };
    });

    console.log(`Deleted user ${user.id} from users table`);

    // Best-effort: the account is closed, so a counter refresh failing must
    // not turn a successful deletion into an error response.
    try {
      await syncStudentCounterTargets(counterTargets);
    } catch (counterError) {
      console.error(
        `Failed to re-sync enrollment counters after deleting user ${user.id}:`,
        counterError
      );
    }

    if (closedUser.email) {
      await sendTemplateEmail("account_closure_confirmation", closedUser.email, {
        displayName: closedUser.displayName,
        email: closedUser.email,
      });
    }

    const response = new Response(
      superjson.stringify({
        success: true,
        message: "Your account has been permanently deleted.",
      } satisfies OutputType)
    );

    clearServerSession(response);

    return response;
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof AccountNotFoundError) {
      return new Response(superjson.stringify({ error: "User not found" }), { status: 404 });
    }
    const blocker = foreignKeyBlocker(error);
    if (blocker) {
      console.error(`Account closure for user ${userId} blocked by ${blocker}; nothing was changed`);
      return new Response(
        superjson.stringify({
          error:
            "Your account can't be closed automatically because students' purchases or published content depend on it. Please contact support and we will close it for you.",
        }),
        { status: 409 }
      );
    }
    console.error("Account closure error:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      { status: 400 }
    );
  }
}