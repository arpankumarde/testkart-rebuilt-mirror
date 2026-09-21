import { z } from "zod";
import superjson from "superjson";
import { schema, OutputType } from "./verify-and-register_POST.schema";
import { db } from "../../../helpers/db";
import { assignUserSlug } from "../../../helpers/assignUserSlug";
import {
  setServerSession,
  Session,
  SessionExpirationSeconds,
} from "../../../helpers/getSetServerSession";
import { randomUUID } from "crypto";
import { sendEmail } from "../../../helpers/sendEmail";
import { welcomeStudent, welcomeTeacher } from "../../../helpers/emailTemplates";
import { addContactToAudience } from "../../../helpers/resendContacts";
import { addTeacherToSalesContacts } from "../../../helpers/addTeacherToSalesContacts";
import { getClientIp } from "../../../helpers/getClientIp";
import {
  checkOtpVerifyLimit,
  claimOtpAttempt,
  recordOtpVerifyFailure,
} from "../../../helpers/otpVerifyGuard";
import { checkTeacherSecondContact } from "../../../helpers/teacherSignupContact";

export async function handle(request: Request): Promise<Response> {
  try {
    const json = superjson.parse(await request.text());
    const { mobileNumber, otpCode, role, displayName, email } = schema.parse(json);
    const ipAddress = getClientIp(request);

    const limitMessage = await checkOtpVerifyLimit(mobileNumber, ipAddress);
    if (limitMessage) {
      return new Response(superjson.stringify({ error: limitMessage }), { status: 429 });
    }

    // 1. Find the most recent unverified OTP for this number
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

    // 2. Check for expiry
    if (new Date() > new Date(otpRecord.expiresAt)) {
      return new Response(superjson.stringify({ error: "OTP has expired." }), {
        status: 400,
      });
    }

    // 3. Use up an attempt before comparing, so parallel guesses share the limit
    const storedCode = await claimOtpAttempt("mobile", otpRecord.id);
    if (storedCode === null) {
      return new Response(
        superjson.stringify({
          error: "Maximum verification attempts reached. Please request a new OTP.",
        }),
        { status: 400 }
      );
    }

    if (storedCode !== otpCode) {
      await recordOtpVerifyFailure(mobileNumber, ipAddress);
      return new Response(superjson.stringify({ error: "Invalid OTP code." }), {
        status: 400,
      });
    }

    // 4. Race condition check: ensure user doesn't exist
    const existingUser = await db
      .selectFrom("users")
      .select("id")
      .where("mobileNumber", "=", mobileNumber)
      .executeTakeFirst();

    if (existingUser) {
      return new Response(
        superjson.stringify({
          error: "An account with this mobile number already exists.",
        }),
        { status: 409 }
      );
    }

    const contactError = await checkTeacherSecondContact(role, "email", email);
    if (contactError) {
      return new Response(superjson.stringify({ error: contactError }), { status: 400 });
    }

    // 5. Create the user with the provided displayName
    const newUser = await db
      .insertInto("users")
      .values({
        displayName,
        mobileNumber,
        email: role === "teacher" && email ? email : null,
        role: role,
        mobileVerified: true,
        emailVerified: false,
        isActive: true,
        avatarUrl: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // For students, generate avatar URL using DiceBear with user ID as seed
    const finalAvatarUrl = role === "student"
      ? `https://api.dicebear.com/9.x/fun-emoji/png?seed=${newUser.id}`
      : null;

    // Persist avatar first, then safely generate+assign a unique slug
    // (assignUserSlug retries on a unique-constraint race instead of
    // leaving the account with slug = NULL if a collision throws).
    await db
      .updateTable("users")
      .set({ avatarUrl: finalAvatarUrl })
      .where("id", "=", newUser.id)
      .execute();
    const slug = await assignUserSlug(newUser.id, displayName);
    console.log(`Slug generated for user ${newUser.id}: ${slug}`);

    const updatedUser = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", newUser.id)
      .executeTakeFirstOrThrow();

    // 6. Assign free plan to teacher if applicable
    if (role === "teacher") {
      const freePlan = await db
        .selectFrom("subscriptionPlans")
        .select(["id", "durationDays"])
        .where("price", "=", "0")
        .where("isActive", "=", true)
        .executeTakeFirst();

      if (freePlan) {
        const now = new Date();
        let endDate: Date | null = null;

        if (freePlan.durationDays) {
          endDate = new Date(now.getTime() + freePlan.durationDays * 24 * 60 * 60 * 1000);
        }

        await db
          .insertInto("teacherSubscriptions")
          .values({
            teacherId: updatedUser.id,
            planId: freePlan.id,
            status: "active",
            startDate: now,
            endDate: endDate,
            nextChargeDate: null,
          })
          .execute();
      } else {
        console.warn(
          `No active free plan found (price = 0) for teacher mobile signup. Teacher ${updatedUser.id} registered without subscription.`
        );
      }
    }

    // Add teacher to sales contacts (non-blocking, fire-and-forget)
    if (role === "teacher") {
      addTeacherToSalesContacts(updatedUser.id);
    }

    // 7. Mark OTP as verified
    await db
      .updateTable("mobileOtps")
      .set({ verifiedAt: new Date(), userId: updatedUser.id })
      .where("id", "=", otpRecord.id)
      .execute();

    // 8. Create a new session
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      createdAt: now,
      lastAccessed: now,
    };

    await db.insertInto("sessions").values({
      id: session.id,
      userId: updatedUser.id,
      expiresAt: new Date(now + SessionExpirationSeconds * 1000),
    }).execute();

    // 9. Set session cookie on a temp response to extract the JWT token
    const tempResponse = new Response();
    await setServerSession(tempResponse, session);

    const setCookieHeader = tempResponse.headers.get("Set-Cookie") || "";
    // The cookie format is: <cookieName>=<token>; HttpOnly; ...
    const token = setCookieHeader.split("=").slice(1).join("=").split(";")[0] || "";

    console.log(`Mobile signup successful for mobile: ${mobileNumber}, userId: ${updatedUser.id}`);

    const response = new Response(
      superjson.stringify({
        user: {
          id: updatedUser.id,
          displayName: updatedUser.displayName,
          email: updatedUser.email,
          avatarUrl: updatedUser.avatarUrl,
          role: role,
          mobileNumber: updatedUser.mobileNumber,
          mobileVerified: updatedUser.mobileVerified,
        },
        token,
      } satisfies OutputType)
    );

    response.headers.set("Set-Cookie", setCookieHeader);

    // Send welcome email if email is provided (non-blocking)
    if (updatedUser.email) {
      const sendWelcomeEmail = async () => {
        try {
          const templateKey = role === "student" ? "welcome_student" : "welcome_teacher";

          const template = await db
            .selectFrom("emailTemplates")
            .selectAll()
            .where("templateKey", "=", templateKey)
            .where("isActive", "=", true)
            .executeTakeFirst();

          let subject: string;
          let html: string;
          let text: string;

          if (template) {
            const replacePlaceholders = (str: string, data: Record<string, string>) => {
              return Object.entries(data).reduce(
                (acc, [key, value]) => acc.replace(new RegExp(`{{${key}}}`, "g"), value),
                str
              );
            };

            const placeholders = {
              displayName: updatedUser.displayName,
              email: updatedUser.email!,
            };

            subject = replacePlaceholders(template.subject, placeholders);
            html = replacePlaceholders(template.htmlContent, placeholders);
            text = replacePlaceholders(template.textContent || "", placeholders);
          } else {
            console.warn(`${templateKey} template not found in database, using fallback`);
            const emailTemplate =
              role === "student"
                ? welcomeStudent(updatedUser.displayName, updatedUser.email!)
                : welcomeTeacher(updatedUser.displayName, updatedUser.email!);
            subject = emailTemplate.subject;
            html = emailTemplate.html;
            text = emailTemplate.text;
          }

          const result = await sendEmail({
            to: updatedUser.email!,
            subject,
            html,
            text,
          });

          if (result.success) {
            console.log(`Welcome email sent successfully to ${updatedUser.email}`);
          } else {
            console.error(`Failed to send welcome email to ${updatedUser.email}:`, result.error);
          }
        } catch (error) {
          console.error(`Error sending welcome email to ${updatedUser.email}:`, error);
        }
      };

      sendWelcomeEmail();

      try {
        const firstName = updatedUser.displayName.split(" ")[0];
        const contactResult = await addContactToAudience(updatedUser.email, firstName, role, updatedUser.id);
        if (contactResult.success) {
          console.log(`Contact synced to Resend: ${updatedUser.email}`);
        } else {
          console.error(`Failed to sync contact to Resend:`, contactResult.error);
        }
      } catch (err) {
        console.error("Failed to sync contact to Resend:", err);
      }
    }

    return response;
  } catch (error) {
    console.error("Error in verify-and-register endpoint:", error);
    if (error instanceof z.ZodError) {
      return new Response(superjson.stringify({ error: error.errors }), {
        status: 400,
      });
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}