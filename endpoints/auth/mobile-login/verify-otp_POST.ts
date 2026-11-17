import { z } from "zod";
import superjson from "superjson";
import { schema, OutputType } from "./verify-otp_POST.schema";
import { db } from "../../../helpers/db";
import { allAccounts } from "../../../helpers/allAccounts";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../../helpers/getSetServerSession";
import { addTeacherToSalesContacts } from "../../../helpers/addTeacherToSalesContacts";
import { sendTeacherOnboardingWhatsApp } from "../../../helpers/sendTeacherOnboardingWhatsApp";
import { assignUserSlug } from "../../../helpers/assignUserSlug";
import { randomUUID } from "crypto";
import { getClientIp } from "../../../helpers/getClientIp";
import { getAccountBlockMessage } from "../../../helpers/accountSuspension";
import {
  checkOtpVerifyLimit,
  claimOtpAttempt,
  recordOtpVerifyFailure,
} from "../../../helpers/otpVerifyGuard";
import { recordSignIn } from "../../../helpers/recordSignIn";
import { syncWaplifyContact } from "../../../helpers/syncWaplifyContact";
import { maskEmail } from "../../../helpers/organizationClaim";
import {
  createAccountChoiceResponse,
  findLoginAccounts,
  resolveLogin,
  sideFromRoleParam,
} from "../../../helpers/loginAccount";
import { insertAccount, updateAccount } from "../../../helpers/accountRows";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { mobileNumber, otpCode, role, supportsAccountChoice } = schema.parse(json);
    const ipAddress = getClientIp(request);

    const limitMessage = await checkOtpVerifyLimit(mobileNumber, ipAddress);
    if (limitMessage) {
      return new Response(superjson.stringify({ error: limitMessage }), { status: 429 });
    }

    // 1. Find the most recent, unverified OTP for this number
    const otpRecord = await db
      .selectFrom("mobileOtps")
      .selectAll()
      .where("mobileNumber", "=", mobileNumber)
      .where("verifiedAt", "is", null)
      .orderBy("createdAt", "desc")
      .executeTakeFirst();

    if (!otpRecord) {
      return new Response(
        superjson.stringify({ error: "Invalid OTP or request. Please try again." }),
        { status: 400 }
      );
    }

    // 2. Check for expiration
    if (new Date() > new Date(otpRecord.expiresAt)) {
      return new Response(
        superjson.stringify({ error: "OTP has expired. Please request a new one." }),
        { status: 400 }
      );
    }

    // 3. Use up an attempt before comparing, so parallel guesses share the limit
    const storedCode = await claimOtpAttempt("mobile", otpRecord.id);
    if (storedCode === null) {
      return new Response(
        superjson.stringify({ error: "Too many incorrect attempts. Please request a new OTP." }),
        { status: 400 }
      );
    }

    if (storedCode !== otpCode) {
      await recordOtpVerifyFailure(mobileNumber, ipAddress);
      return new Response(superjson.stringify({ error: "Invalid OTP code." }), {
        status: 400,
      });
    }

    // 4. OTP is correct: find this side's account, or offer the other side's (helpers/loginAccount)
    const side = sideFromRoleParam(role);
    const resolution = resolveLogin(await findLoginAccounts({ mobileNumber }, side), supportsAccountChoice ?? false);
    if (resolution.kind === "choice") {
      await db.updateTable("mobileOtps").set({ verifiedAt: new Date() }).where("id", "=", otpRecord.id).execute();
      const choiceOutput = await createAccountChoiceResponse({
        side,
        otherAccount: resolution.otherAccount,
        identifier: { mobileNumber },
        method: "mobile_otp",
      });
      return new Response(superjson.stringify(choiceOutput));
    }
    let user = resolution.kind === "existing" ? resolution.account : undefined;

    if (user) {
      const blockedMessage = await getAccountBlockMessage(user.id);
      if (blockedMessage) {
        return new Response(superjson.stringify({ error: blockedMessage }), { status: 403 });
      }
    }

    // An existing account carries this number unverified: send them to it instead of creating a duplicate
    if (!user) {
      const unverifiedOwner = await db
        .selectFrom(allAccounts(db).as("users"))
        .select(["id", "email"])
        .where("mobileNumber", "=", mobileNumber)
        .where("mobileVerified", "=", false)
        .where("role", "=", role === "teacher" ? "teacher" : "student")
        .orderBy("id", "asc")
        .executeTakeFirst();

      if (unverifiedOwner) {
        await db
          .updateTable("mobileOtps")
          .set({ verifiedAt: new Date() })
          .where("id", "=", otpRecord.id)
          .execute();
        console.log(
          `OTP login refused for mobile: ${mobileNumber}, unverified on userId: ${unverifiedOwner.id}`
        );
        const error = unverifiedOwner.email
          ? `This number is on an account that signs in with email (${maskEmail(unverifiedOwner.email)}). Sign in with that email, then verify this number in your profile to use phone sign-in.`
          : "This number is on an existing account that has not verified it. Sign in the way you signed up, then verify this number in your profile to use phone sign-in.";
        return new Response(superjson.stringify({ error }), { status: 409 });
      }
    }

    // 5. If no user exists, create a new account (signup flow)
    const isNewUser = !user;
    if (!user) {
      const newUser = await insertAccount(db, side, {
        displayName: "User",
        mobileNumber,
        mobileVerified: true,
        email: null,
        isActive: true,
      });

      const finalDisplayName = `User_${newUser.id}`;
      const avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${newUser.id}`;

      await updateAccount(db, side, newUser.id, { displayName: finalDisplayName, avatarUrl });

      await assignUserSlug(newUser.id, finalDisplayName);

      await db
        .updateTable("mobileOtps")
        .set({ userId: newUser.id })
        .where("id", "=", otpRecord.id)
        .execute();

      // Assign free plan to new teacher if applicable
      if (newUser.role === "teacher") {
        try {
          const freePlan = await db
            .selectFrom("subscriptionPlans")
            .select(["id", "durationDays"])
            .where("price", "=", "0")
            .where("isActive", "=", true)
            .executeTakeFirst();

          if (freePlan) {
            const nowTime = new Date();
            let endDate: Date | null = null;

            if (freePlan.durationDays) {
              endDate = new Date(nowTime.getTime() + freePlan.durationDays * 24 * 60 * 60 * 1000);
            }

            await db
              .insertInto("teacherSubscriptions")
              .values({
                teacherId: newUser.id,
                planId: freePlan.id,
                status: "active",
                startDate: nowTime,
                endDate: endDate,
                nextChargeDate: null,
              })
              .execute();
          } else {
            console.warn(
              `No active free plan found (price = 0) for teacher mobile login signup. Teacher ${newUser.id} registered without subscription.`
            );
          }
        } catch (subErr) {
          console.error("Failed to assign free plan to new teacher:", subErr);
        }
      }

      if (newUser.role === "teacher") {
        addTeacherToSalesContacts(newUser.id);
        await sendTeacherOnboardingWhatsApp({
          userId: newUser.id,
          mobileNumber: newUser.mobileNumber,
          name: null,
        });
      } else {
        await syncWaplifyContact(newUser.id);
      }

      user = {
        ...newUser,
        displayName: finalDisplayName,
        avatarUrl,
      };
    }

    // 6. Create a new session
    const now = Date.now();
    const sessionId = randomUUID();
    await db
      .insertInto("sessions")
      .values({
        id: sessionId,
        userId: user.id,
        createdAt: new Date(now),
        lastAccessed: new Date(now),
        expiresAt: new Date(now + SessionExpirationSeconds * 1000),
      })
      .execute();

    // 7. Mark OTP as verified
    await db
      .updateTable("mobileOtps")
      .set({ verifiedAt: new Date() })
      .where("id", "=", otpRecord.id)
      .execute();

    // 8. Set session cookie on a temp response to extract the JWT token
    const tempResponse = new Response();
    await setServerSession(tempResponse, {
      id: sessionId,
      createdAt: now,
      lastAccessed: now,
    });

    const setCookieHeader = tempResponse.headers.get("Set-Cookie") || "";
    // The cookie format is: <cookieName>=<token>; HttpOnly; ...
    const token = setCookieHeader.split("=").slice(1).join("=").split(";")[0] || "";

    console.log(`OTP login successful for mobile: ${mobileNumber}, userId: ${user.id}`);
    await recordSignIn(request, user.id, isNewUser ? "signup" : "login", "mobile_otp");

    const response = new Response(
      superjson.stringify({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role === "student" ? "student" : user.role,
          mobileNumber: user.mobileNumber,
          mobileVerified: user.mobileVerified,
        },
        token,
      } satisfies OutputType)
    );

    response.headers.set("Set-Cookie", setCookieHeader);

    return response;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    if (error instanceof z.ZodError) {
      return new Response(superjson.stringify({ error: error.errors }), {
        status: 400,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}