import { z } from "zod";
import superjson from "superjson";
import { schema } from "./account-choice_POST.schema";
import { db } from "../../helpers/db";
import { allAccounts } from "../../helpers/allAccounts";
import { getAccountBlockMessage } from "../../helpers/accountSuspension";
import {
  createLoginAccount,
  findLoginAccounts,
  readAccountChoiceToken,
  startLoginSession,
  type LoginIdentifier,
} from "../../helpers/loginAccount";

const fail = (error: string, status: number) => new Response(superjson.stringify({ error }), { status });

/**
 * Second step of a sign-in that matched only an account on the other side (helpers/loginAccount).
 * The choice token proves the email or mobile was verified in the last 10 minutes.
 */
export async function handle(request: Request) {
  try {
    const { choiceToken, choice } = schema.parse(superjson.parse(await request.text()));
    const payload = await readAccountChoiceToken(choiceToken);
    if (!payload) {
      return fail("This sign-in has expired. Please sign in again.", 400);
    }
    const identifier: LoginIdentifier = payload.email
      ? { email: payload.email }
      : { mobileNumber: payload.mobileNumber as string };

    if (choice === "existing") {
      const { sameSide: account } = await findLoginAccounts(identifier, payload.side === "student" ? "teacher" : "student");
      if (!account || account.id !== payload.otherAccountId) {
        return fail("This sign-in has expired. Please sign in again.", 400);
      }
      const blockedMessage = await getAccountBlockMessage(account.id);
      if (blockedMessage) return fail(blockedMessage, 403);
      return await startLoginSession(request, account, "login", payload.method);
    }

    const existing = (await findLoginAccounts(identifier, payload.side)).sameSide;
    if (existing) {
      const blockedMessage = await getAccountBlockMessage(existing.id);
      if (blockedMessage) return fail(blockedMessage, 403);
      return await startLoginSession(request, existing, "login", payload.method);
    }

    if ("mobileNumber" in identifier) {
      const unverifiedOwner = await db
        .selectFrom(allAccounts(db).as("users"))
        .select("id")
        .where("mobileNumber", "=", identifier.mobileNumber)
        .where("mobileVerified", "=", false)
        .where("role", "=", payload.side)
        .executeTakeFirst();
      if (unverifiedOwner) {
        return fail(
          "This number is on an existing account that has not verified it. Sign in the way you signed up, then verify this number in your profile to use phone sign-in.",
          409
        );
      }
    }

    const account = await createLoginAccount(payload.side, identifier);
    return await startLoginSession(request, account, "signup", payload.method);
  } catch (error) {
    console.error("Error completing account choice:", error);
    if (error instanceof z.ZodError) return fail("Invalid request.", 400);
    return fail("We couldn't complete sign-in. Please try again.", 500);
  }
}
