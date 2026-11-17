import { jwtVerify, SignJWT } from "jose";
import superjson from "superjson";
import { randomUUID } from "crypto";
import { db } from "./db";
import { setServerSession, SessionExpirationSeconds } from "./getSetServerSession";
import { assignUserSlug } from "./assignUserSlug";
import { addTeacherToSalesContacts } from "./addTeacherToSalesContacts";
import { sendTeacherOnboardingWhatsApp } from "./sendTeacherOnboardingWhatsApp";
import { syncWaplifyContact } from "./syncWaplifyContact";
import { sendTemplateEmail } from "./sendTemplateEmail";
import { addContactToAudience } from "./resendContacts";
import { recordSignIn } from "./recordSignIn";

/**
 * Sign-in is per side since the users split (testkart/misc/USER-SPLIT-SPEC.md, Phase 3): the student
 * side and the teacher side each look for an account of their own role. When the email or mobile only
 * matches an account on the other side, a client that sends supportsAccountChoice gets a choice
 * ("continue with that account" or "set up one on this side") through a short-lived choice token and
 * auth/account-choice. Clients that do not send it, such as the shipped mobile app, keep the old
 * behaviour and are signed into the other side's account.
 */

import { insertAccount, updateAccount, type AccountSide } from "./accountRows";
import { allAccounts } from "./allAccounts";
export type { AccountSide };

export type LoginIdentifier = { email: string } | { mobileNumber: string };

export type LoginMethod = "email_otp" | "mobile_otp" | "password" | "google";

const LOGIN_METHODS: readonly LoginMethod[] = ["email_otp", "mobile_otp", "password", "google"];

export type LoginAccount = {
  id: number;
  email: string | null;
  displayName: string;
  role: "admin" | "student" | "teacher";
  avatarUrl: string | null;
  mobileNumber: string | null;
  mobileVerified: boolean;
};

export type LoginResolution =
  | { kind: "existing"; account: LoginAccount }
  | { kind: "choice"; otherAccount: LoginAccount }
  | { kind: "create" };

export type AccountChoiceOutput = {
  accountChoice: "teacher_exists" | "student_exists";
  choiceToken: string;
  existingAccount: { displayName: string; avatarUrl: string | null };
};

export const sideFromRoleParam = (role: string | undefined | null): AccountSide =>
  role === "teacher" ? "teacher" : "student";

const LOGIN_ACCOUNT_COLUMNS = [
  "id",
  "email",
  "displayName",
  "role",
  "avatarUrl",
  "mobileNumber",
  "mobileVerified",
] as const;

/** The verified account on each side for an email or mobile number. */
export async function findLoginAccounts(identifier: LoginIdentifier, side: AccountSide) {
  let query = db.selectFrom(allAccounts(db).as("account")).select([...LOGIN_ACCOUNT_COLUMNS]);
  query =
    "email" in identifier
      ? query.where("email", "=", identifier.email).where("emailVerified", "=", true)
      : query.where("mobileNumber", "=", identifier.mobileNumber).where("mobileVerified", "=", true);
  const rows: LoginAccount[] = await query.orderBy("id", "asc").execute();
  return {
    sameSide: rows.find((r) => r.role === side) ?? null,
    otherSide: rows.find((r) => r.role !== side) ?? null,
  };
}

export function resolveLogin(
  accounts: { sameSide: LoginAccount | null; otherSide: LoginAccount | null },
  supportsAccountChoice: boolean
): LoginResolution {
  if (accounts.sameSide) return { kind: "existing", account: accounts.sameSide };
  if (accounts.otherSide) {
    return supportsAccountChoice
      ? { kind: "choice", otherAccount: accounts.otherSide }
      : { kind: "existing", account: accounts.otherSide };
  }
  return { kind: "create" };
}

/* ------------------------------------------------------------ choice token --- */

const CHOICE_PURPOSE = "account_choice";
const encoder = new TextEncoder();
const choiceSecret = () => encoder.encode(process.env.JWT_SECRET);

type ChoicePayload = {
  side: AccountSide;
  otherAccountId: number;
  method: LoginMethod;
  email: string | null;
  mobileNumber: string | null;
};

export async function createAccountChoiceResponse(params: {
  side: AccountSide;
  otherAccount: LoginAccount;
  identifier: LoginIdentifier;
  method: LoginMethod;
}): Promise<AccountChoiceOutput> {
  const payload: ChoicePayload = {
    side: params.side,
    otherAccountId: params.otherAccount.id,
    method: params.method,
    email: "email" in params.identifier ? params.identifier.email : null,
    mobileNumber: "mobileNumber" in params.identifier ? params.identifier.mobileNumber : null,
  };
  const choiceToken = await new SignJWT({ purpose: CHOICE_PURPOSE, ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(choiceSecret());
  return {
    accountChoice: params.side === "student" ? "teacher_exists" : "student_exists",
    choiceToken,
    existingAccount: {
      displayName: params.otherAccount.displayName,
      avatarUrl: params.otherAccount.avatarUrl,
    },
  };
}

/** Null when the token is invalid, expired or not a choice token. */
export async function readAccountChoiceToken(token: string): Promise<ChoicePayload | null> {
  try {
    const { payload } = await jwtVerify(token, choiceSecret());
    if (payload.purpose !== CHOICE_PURPOSE) return null;
    const side = payload.side === "teacher" ? "teacher" : payload.side === "student" ? "student" : null;
    const method = payload.method as LoginMethod;
    if (!side || typeof payload.otherAccountId !== "number") return null;
    if (!LOGIN_METHODS.includes(method)) return null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const mobileNumber = typeof payload.mobileNumber === "string" ? payload.mobileNumber : null;
    if (!email && !mobileNumber) return null;
    return { side, otherAccountId: payload.otherAccountId, method, email, mobileNumber };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------- new account ---- */

/**
 * Creates an account on a side for a verified email or mobile, with the same follow-up as the
 * email and mobile OTP signups: placeholder name and avatar, slug, the free plan and sales contact
 * for teachers, the welcome email or WhatsApp contact for students.
 */
export async function createLoginAccount(side: AccountSide, identifier: LoginIdentifier): Promise<LoginAccount> {
  const byEmail = "email" in identifier;
  const created = await insertAccount(db, side, {
    displayName: "User",
    isActive: true,
    email: byEmail ? identifier.email : null,
    emailVerified: byEmail,
    mobileNumber: byEmail ? null : identifier.mobileNumber,
    mobileVerified: !byEmail,
  });

  const displayName = `User_${created.id}`;
  const avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${created.id}`;
  await updateAccount(db, side, created.id, { displayName, avatarUrl });
  await assignUserSlug(created.id, displayName);

  if (side === "teacher") {
    try {
      const freePlan = await db
        .selectFrom("subscriptionPlans")
        .select(["id", "durationDays"])
        .where("price", "=", "0")
        .where("isActive", "=", true)
        .executeTakeFirst();
      if (freePlan) {
        const startDate = new Date();
        const endDate = freePlan.durationDays
          ? new Date(startDate.getTime() + freePlan.durationDays * 24 * 60 * 60 * 1000)
          : null;
        await db
          .insertInto("teacherSubscriptions")
          .values({ teacherId: created.id, planId: freePlan.id, status: "active", startDate, endDate, nextChargeDate: null })
          .execute();
      } else {
        console.warn(`No active free plan found (price = 0). Teacher ${created.id} registered without subscription.`);
      }
    } catch (error) {
      console.error("Failed to assign free plan to new teacher:", error);
    }
    addTeacherToSalesContacts(created.id);
    if (!byEmail) {
      await sendTeacherOnboardingWhatsApp({ userId: created.id, mobileNumber: created.mobileNumber, name: null });
    }
  } else if (byEmail) {
    const studentEmail = identifier.email;
    await Promise.all([
      sendTemplateEmail("welcome_student", studentEmail, { displayName: "friend", email: studentEmail }).then((result) => {
        if (!result.success) console.error(`Failed to send welcome email to ${studentEmail}`);
      }),
      addContactToAudience(studentEmail, "", "student", created.id)
        .then((result) => {
          if (!result.success) console.error("Failed to sync contact to Resend:", result.error);
        })
        .catch((error) => console.error("Failed to sync contact to Resend:", error)),
    ]);
  } else {
    await syncWaplifyContact(created.id);
  }

  return { ...created, displayName, avatarUrl };
}

/* -------------------------------------------------------------- session ---- */

/** Starts a session for the account and returns the same body and cookie as the OTP login endpoints. */
export async function startLoginSession(
  request: Request,
  account: LoginAccount,
  kind: "signup" | "login",
  method: LoginMethod
): Promise<Response> {
  const now = Date.now();
  const sessionId = randomUUID();
  await db
    .insertInto("sessions")
    .values({
      id: sessionId,
      userId: account.id,
      createdAt: new Date(now),
      lastAccessed: new Date(now),
      expiresAt: new Date(now + SessionExpirationSeconds * 1000),
    })
    .execute();

  const tempResponse = new Response();
  await setServerSession(tempResponse, { id: sessionId, createdAt: now, lastAccessed: now });
  const setCookieHeader = tempResponse.headers.get("Set-Cookie") || "";
  const token = setCookieHeader.split("=").slice(1).join("=").split(";")[0] || "";

  await recordSignIn(request, account.id, kind, method);

  const response = new Response(
    superjson.stringify({
      user: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        role: account.role,
        mobileNumber: account.mobileNumber,
        mobileVerified: account.mobileVerified,
      },
      token,
    })
  );
  response.headers.set("Set-Cookie", setCookieHeader);
  return response;
}
