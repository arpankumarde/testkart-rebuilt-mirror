import { db } from "../../helpers/db";
import { schema, OutputType } from "./register_student_POST.schema";
import { randomBytes } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import superjson from "superjson";
import { UserRole } from "../../helpers/schema";
import { sendEmail } from "../../helpers/sendEmail";
import { welcomeStudent } from "../../helpers/emailTemplates";
import { addContactToAudience } from "../../helpers/resendContacts";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email, password, displayName } = schema.parse(json);

    // Check if email already exists
    const existingUser = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .limit(1)
      .executeTakeFirst();

    if (existingUser) {
      return new Response(
        superjson.stringify({ error: "Email already in use" }),
        { status: 409 }
      );
    }

    const passwordHash = await generatePasswordHash(password);
    const studentRole: UserRole = "student";

    // Create new user
    const newUser = await db.transaction().execute(async (trx) => {
      const user = await trx
        .insertInto("users")
        .values({
          email,
          displayName,
          role: studentRole,
        })
        .returning(["id", "email", "displayName", "avatarUrl", "role", "mobileNumber", "mobileVerified"])
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("userPasswords")
        .values({
          userId: user.id,
          passwordHash,
        })
        .execute();

      return user;
    });

    // Set avatar URL based on the new user's ID
    const avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${newUser.id}`;
    await db
      .updateTable("users")
      .set({ avatarUrl })
      .where("id", "=", newUser.id)
      .execute();
    console.log(`Avatar URL set for student ${newUser.id}: ${avatarUrl}`);

    // Create a new session
    const sessionId = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SessionExpirationSeconds * 1000);

    await db
      .insertInto("sessions")
      .values({
        id: sessionId,
        userId: newUser.id,
        createdAt: now,
        lastAccessed: now,
        expiresAt,
      })
      .execute();

    const output: OutputType = {
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        avatarUrl: avatarUrl,
        role: newUser.role as "student", // The DB returns UserRole, we cast to the specific role for this endpoint
        mobileNumber: newUser.mobileNumber,
        mobileVerified: newUser.mobileVerified,
      },
    };

    const response = new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });

    // Sync contact to Resend
    const firstName = newUser.displayName.split(" ")[0];
    try {
      const contactResult = await addContactToAudience(email, firstName, "student", newUser.id);
      if (contactResult.success) {
        console.log(`Student contact synced to Resend: ${email}`);
      } else {
        console.error(`Failed to sync student to Resend:`, contactResult.error);
      }
    } catch (err) {
      console.error("Failed to sync student to Resend:", err);
    }

    // Set session cookie
    await setServerSession(response, {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
    });

    // Send welcome email
    const sendWelcomeEmail = async () => {
      try {
        // Fetch email template from database
        const template = await db
          .selectFrom("emailTemplates")
          .selectAll()
          .where("templateKey", "=", "welcome_student")
          .where("isActive", "=", true)
          .executeTakeFirst();

        let subject: string;
        let html: string;
        let text: string;

        if (template) {
          // Replace placeholders
          const replacePlaceholders = (str: string, data: Record<string, string>) => {
            return Object.entries(data).reduce(
              (acc, [key, value]) => acc.replace(new RegExp(`{{${key}}}`, 'g'), value),
              str
            );
          };

          const placeholders = {
            displayName: newUser.displayName,
            email: email,
          };

          subject = replacePlaceholders(template.subject, placeholders);
          html = replacePlaceholders(template.htmlContent, placeholders);
          text = replacePlaceholders(template.textContent || "", placeholders);
        } else {
          // Fallback to imported helper
          console.warn("Welcome student template not found in database, using fallback");
          const emailTemplate = welcomeStudent(newUser.displayName, email);
          subject = emailTemplate.subject;
          html = emailTemplate.html;
          text = emailTemplate.text;
        }

        const result = await sendEmail({
          to: email,
          subject,
          html,
          text,
        });

        if (result.success) {
          console.log(`Welcome email sent successfully to ${newUser.email}`);
        } else {
          console.error(`Failed to send welcome email to ${newUser.email}:`, result.error);
        }
      } catch (error) {
        console.error(`Error sending welcome email to ${newUser.email}:`, error);
      }
    };
 
   await sendWelcomeEmail();
 
    return response;
  } catch (error: unknown) {
    console.error("Student registration error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Registration failed";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}