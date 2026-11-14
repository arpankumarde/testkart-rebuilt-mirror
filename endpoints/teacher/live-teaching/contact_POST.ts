import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { checkTeacherSecondContact } from "../../../helpers/teacherSignupContact";
import { syncWaplifyContact } from "../../../helpers/syncWaplifyContact";
import { schema, OutputType } from "./contact_POST.schema";

/*
 * Adds the account email or mobile number the live teaching application needs,
 * stored unverified as onboarding does. A value already on the account is never
 * replaced here.
 */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" || user.teacherRole === "manager") {
      return new Response(superjson.stringify({ error: "Only the account owner can add contact details." }), {
        status: 403,
      });
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const existing = await db
      .selectFrom("users")
      .select(["email", "mobileNumber"])
      .where("id", "=", effectiveTeacherId)
      .executeTakeFirst();
    if (!existing) {
      return new Response(superjson.stringify({ error: "Teacher not found" }), { status: 404 });
    }

    const updates: { email?: string; emailVerified?: boolean; mobileNumber?: string; mobileVerified?: boolean } = {};
    if (!existing.email && input.email) {
      const problem = await checkTeacherSecondContact("teacher", "email", input.email);
      if (problem) return new Response(superjson.stringify({ error: problem }), { status: 400 });
      updates.email = input.email;
      updates.emailVerified = false;
    }
    if (!existing.mobileNumber && input.mobileNumber) {
      const problem = await checkTeacherSecondContact("teacher", "mobileNumber", input.mobileNumber);
      if (problem) return new Response(superjson.stringify({ error: problem }), { status: 400 });
      updates.mobileNumber = input.mobileNumber;
      updates.mobileVerified = false;
    }

    if (Object.keys(updates).length === 0) {
      const output: OutputType = { email: existing.email, mobileNumber: existing.mobileNumber };
      return new Response(superjson.stringify(output));
    }

    const updated = await db
      .updateTable("users")
      .set({ ...updates, updatedAt: new Date() })
      .where("id", "=", effectiveTeacherId)
      .returning(["email", "mobileNumber"])
      .executeTakeFirstOrThrow();
    await syncWaplifyContact(effectiveTeacherId);

    const output: OutputType = { email: updated.email, mobileNumber: updated.mobileNumber };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving live teaching contact details:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: error.errors[0]?.message ?? "Check your details." }), {
        status: 400,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}