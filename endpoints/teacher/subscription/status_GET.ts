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

    // An admin-granted custom trial stores its fee on
    // teacherSubscriptions.platformFeeOverride, not on the plan — this used
    // to always show the plan's default fee here, so a teacher on a custom
    // trial (e.g. a 15% override on the free plan) would see the free
    // plan's normal 30% on their own dashboard instead of their real rate.
    const effectivePlatformFeePercentage =
      subscription.platformFeeOverride !== null && subscription.platformFeeOverride !== undefined
        ? Number(subscription.platformFeeOverride)
        : Number(subscription.planPlatformFeePercentage);

    const output: OutputType = {
      ...subscription,
      planPrice: Number(subscription.planPrice),
      platformFeePercentage: effectivePlatformFeePercentage,
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