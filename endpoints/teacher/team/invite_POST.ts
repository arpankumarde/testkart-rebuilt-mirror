import { schema, OutputType } from "./invite_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { requireOwnerRole } from '../../../helpers/getTeacherContext';
import { db } from '../../../helpers/db';
import { generateUniqueSlug } from '../../../helpers/generateUniqueSlug';

export async function handle(request: Request) {
  try {
    const { user, teacherRole, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" || !teacherRole) {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Only account owners can invite team members
    requireOwnerRole(teacherRole);

    const json = superjson.parse(await request.text());
    const { displayName, phone } = schema.parse(json);

    // Check if phone exists anywhere in the user database
    const existingUser = await db.
    selectFrom("users").
    select("id").
    where("mobileNumber", "=", phone).
    executeTakeFirst();

    if (existingUser) {
      return new Response(superjson.stringify({ error: "A user with this phone number already exists." }), { status: 400 });
    }

    await db.transaction().execute(async (trx) => {
      const slug = await generateUniqueSlug(displayName);
      const avatarUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

      // Create the new user
      const newUser = await trx.insertInto("users").values({
        displayName,
        mobileNumber: phone,
        mobileVerified: true,
        role: "teacher",
        slug,
        avatarUrl,
        emailVerified: false,
        isActive: true,
        onboardingCompleted: false
      }).returning("id").executeTakeFirstOrThrow();

      // Create the team member record
      await trx.insertInto("teacherTeamMembers").values({
        teacherId: effectiveTeacherId,
        memberUserId: newUser.id,
        role: "manager",
        invitedPhone: phone,
        status: "active"
      }).execute();

      // Look up the free plan id (assuming a plan with price=0 is the default free tier)
      const freePlan = await trx.selectFrom("subscriptionPlans").
      select(["id", "durationDays"]).
      where("price", "=", "0").
      where("isActive", "=", true).
      executeTakeFirst();

      if (freePlan) {
        const durationDays = freePlan.durationDays || 365;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);

        await trx.insertInto("teacherSubscriptions").values({
          teacherId: newUser.id,
          planId: freePlan.id,
          status: "active",
          startDate: new Date(),
          endDate: endDate,
          autoRenew: false
        }).execute();
      }
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invite team member.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}