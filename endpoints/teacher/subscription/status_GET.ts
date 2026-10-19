import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./status_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const subscription = await db
      .selectFrom("teacherSubscriptions")
      .innerJoin(
        "subscriptionPlans",
        "teacherSubscriptions.planId",
        "subscriptionPlans.id"
      )
      .selectAll("teacherSubscriptions")
      .select([
        "subscriptionPlans.name as planName",
        "subscriptionPlans.price as planPrice",
        "subscriptionPlans.durationDays as planDurationDays",
        // Aliased separately from the teacherSubscriptions column of the
        // same underlying concept so neither one silently shadows the
        // other — the effective fee (below) picks whichever actually
        // applies instead of always showing the plan's default.
        "subscriptionPlans.platformFeePercentage as planPlatformFeePercentage",
      ])
      .where("teacherSubscriptions.teacherId", "=", effectiveTeacherId)
      .where("teacherSubscriptions.status", "=", "active")
      .orderBy("teacherSubscriptions.createdAt", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!subscription) {
      return new Response(superjson.stringify(null));
    }

    const account = await db
      .selectFrom("users")
      .select("platformFeeOverride")
      .where("id", "=", effectiveTeacherId)
      .executeTakeFirst();
    const accountFeeOverride = account?.platformFeeOverride ?? null;

    // Same order as getTeacherPlatformFee: a standing account rate on users,
    // then an admin-granted trial fee on teacherSubscriptions.platformFeeOverride,
    // then the plan's own fee.
    const effectivePlatformFeePercentage =
      accountFeeOverride !== null
        ? Number(accountFeeOverride)
        : subscription.platformFeeOverride !== null && subscription.platformFeeOverride !== undefined
          ? Number(subscription.platformFeeOverride)
          : Number(subscription.planPlatformFeePercentage);

    const output: OutputType = {
      ...subscription,
      planPrice: Number(subscription.planPrice),
      platformFeePercentage: effectivePlatformFeePercentage,
      hasAccountFeeOverride: accountFeeOverride !== null,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 401,
      });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}