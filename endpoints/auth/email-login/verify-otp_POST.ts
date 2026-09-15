import { z } from "zod";
import superjson from "superjson";
import { schema, OutputType } from "./verify-otp_POST.schema";
import { db } from "../../../helpers/db";
import { assignUserSlug } from "../../../helpers/assignUserSlug";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../../helpers/getSetServerSession";
import { addTeacherToSalesContacts } from "../../../helpers/addTeacherToSalesContacts";
import { randomUUID } from "crypto";

const MAX_ATTEMPTS = 5;

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email, otpCode, role } = schema.parse(json);

    // 1. Find the most recent, unverified OTP for this email
    const otpRecord = await db
      .selectFrom("emailOtps")
      .selectAll()
      .where("email", "=", email)
      .where("verifiedAt", "is", null)
      .orderBy("createdAt", "desc")
      .executeTakeFirst();

    if (!otpRecord) {
      return new Response(
        superjson.stringify({ error: "Invalid OTP or request. Please try again." }),
        { status: 400 }
      );
    }

    // 2. Check for expiration and max attempts
    if (new Date() > new Date(otpRecord.expiresAt)) {
      return new Response(
        superjson.stringify({ error: "OTP has expired. Please request a new one." }),
        { status: 400 }
      );
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return new Response(
        superjson.stringify({ error: "Too many incorrect attempts. Please request a new OTP." }),
        { status: 400 }
      );
    }

    // 3. Verify OTP code
    if (otpRecord.otpCode !== otpCode) {
      await db
        .updateTable("emailOtps")
        .set({ attempts: otpRecord.attempts + 1 })
        .where("id", "=", otpRecord.id)
        .execute();
      return new Response(superjson.stringify({ error: "Invalid OTP code." }), {
        status: 400,
      });
    }

    // 4. OTP is correct, check if user exists
    let user = await db
      .selectFrom("users")
      .select([
        "id",
        "email",
        "displayName",
        "role",
        "avatarUrl",
        "mobileNumber",
        "mobileVerified",
      ])
      .where("email", "=", email)
      .where("emailVerified", "=", true)
      .executeTakeFirst();

    // 5. If no user exists, create a new account (signup flow)
    if (!user) {
      const newUser = await db
        .insertInto("users")
        .values({
          displayName: "User",
          email,
          emailVerified: true,
          role: role === "teacher" ? "teacher" : "student",
          mobileNumber: null,
          isActive: true,
        })
        .returning([
          "id",
          "email",
          "displayName",
          "role",
          "avatarUrl",
          "mobileNumber",
          "mobileVerified",
        ])
        .executeTakeFirstOrThrow();

      const finalDisplayName = `User_${newUser.id}`;
      const avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${newUser.id}`;

      await db
        .updateTable("users")
        .set({ displayName: finalDisplayName, avatarUrl })
        .where("id", "=", newUser.id)
        .execute();
      await assignUserSlug(newUser.id, finalDisplayName);

      await db
        .updateTable("emailOtps")
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
              `No active free plan found (price = 0) for teacher email login signup. Teacher ${newUser.id} registered without subscription.`
            );
          }
        } catch (subErr) {
          console.error("Failed to assign free plan to new teacher:", subErr);
        }
      }

      if (newUser.role === "teacher") {
        addTeacherToSalesContacts(newUser.id);
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
      .updateTable("emailOtps")
      .set({ verifiedAt: new Date(), userId: user.id })
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
    console.error("Error verifying email OTP:", error);
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