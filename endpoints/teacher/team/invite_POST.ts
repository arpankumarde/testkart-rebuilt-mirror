import { schema, OutputType, MAX_TEAM_MANAGERS, TEAM_SEAT_STATUSES } from "./invite_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { requireOwnerRole } from '../../../helpers/getTeacherContext';
import { db } from '../../../helpers/db';
import { generateUniqueSlug } from '../../../helpers/generateUniqueSlug';

const fail = (error: string) => new Response(superjson.stringify({ error }), { status: 400 });
const ok = (status: OutputType["status"]) =>
  new Response(superjson.stringify({ success: true, status } satisfies OutputType));

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

    const seats = await db.
    selectFrom("teacherTeamMembers").
    select((eb) => eb.fn.countAll<string>().as("count")).
    where("teacherId", "=", effectiveTeacherId).
    where("status", "in", [...TEAM_SEAT_STATUSES]).
    executeTakeFirst();

    if (Number(seats?.count ?? 0) >= MAX_TEAM_MANAGERS) {
      return fail(`Your team is full. An academy can have ${MAX_TEAM_MANAGERS} managers besides you, so remove someone before inviting another.`);
    }

    // Mobile OTP login signs in the verified holder of a number, so that is the account a member uses.
    const existingUser = await db.
    selectFrom("users").
    select(["id", "role"]).
    where("mobileNumber", "=", phone).
    where("mobileVerified", "=", true).
    executeTakeFirst();

    if (existingUser) {
      if (existingUser.id === user.id) {
        return fail("That is your own mobile number.");
      }
      if (existingUser.role === "student") {
        return fail("This number belongs to a student account. Team members need a teacher account, and switching it would cut them off from what they bought, so ask them for a different number.");
      }
      if (existingUser.role !== "teacher") {
        return fail("This number cannot be added to a team.");
      }

      const previous = await db.
      selectFrom("teacherTeamMembers").
      select(["id", "status"]).
      where("teacherId", "=", effectiveTeacherId).
      where("memberUserId", "=", existingUser.id).
      executeTakeFirst();

      if (previous?.status === "active") {
        return fail("This person is already on your team.");
      }
      if (previous?.status === "pending") {
        return fail("You have already invited this person. They need to accept it from their teacher dashboard.");
      }

      const elsewhere = await db.
      selectFrom("teacherTeamMembers").
      select("id").
      where("memberUserId", "=", existingUser.id).
      where("status", "=", "active").
      executeTakeFirst();

      if (elsewhere) {
        return fail("This person is already on another academy's team.");
      }

      const ownTeam = await db.
      selectFrom("teacherTeamMembers").
      select("id").
      where("teacherId", "=", existingUser.id).
      where("status", "in", [...TEAM_SEAT_STATUSES]).
      executeTakeFirst();

      if (ownTeam) {
        return fail("This person runs their own team on Testkart, so they cannot join another one.");
      }

      // An existing account belongs to its holder, so they accept the invite
      // themselves before it changes what their dashboard shows.
      if (previous) {
        await db.updateTable("teacherTeamMembers").
        set({ status: "pending", invitedPhone: phone }).
        where("id", "=", previous.id).
        execute();
      } else {
        await db.insertInto("teacherTeamMembers").values({
          teacherId: effectiveTeacherId,
          memberUserId: existingUser.id,
          role: "manager",
          invitedPhone: phone,
          status: "pending"
        }).execute();
      }

      return ok("pending");
    }

    // The pool has a single connection and the transaction holds it, so the slug
    // lookup (which uses the global db) has to run before the transaction opens.
    const slug = await generateUniqueSlug(displayName);
    const avatarUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

    await db.transaction().execute(async (trx) => {
      // Onboarding is skipped for managers in the app, and stays pending for
      // this account in case it is ever used as its own academy.
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

    return ok("active");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invite team member.";
    return fail(message);
  }
}