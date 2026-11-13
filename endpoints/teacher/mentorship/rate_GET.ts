import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./rate_GET.schema";
import { MENTORSHIP_SESSION_DURATIONS, MENTORSHIP_TRIAL_DISCOUNT_PERCENT } from "../../../helpers/liveLessonConfig";
import { minClassPrice, resolveLivePrices } from "../../../helpers/livePricing";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Only teachers can view this." }), { status: 403 });
    }

    const row = await db
      .selectFrom("users")
      .select(["mentorshipEnabled", "mentorshipRatePerUnit", "mentorshipClassPrice60", "mentorshipTrialDiscount"])
      .where("id", "=", effectiveTeacherId)
      .executeTakeFirst();

    const prices = row ? resolveLivePrices(row) : null;
    const output: OutputType = {
      enabled: !!row?.mentorshipEnabled,
      durations: [...MENTORSHIP_SESSION_DURATIONS],
      prices,
      trialDiscount: row ? row.mentorshipTrialDiscount : true,
      minClassPrice30: minClassPrice(30),
      minClassPrice60: minClassPrice(60),
      trialDiscountPercent30: MENTORSHIP_TRIAL_DISCOUNT_PERCENT[30],
      trialDiscountPercent60: MENTORSHIP_TRIAL_DISCOUNT_PERCENT[60],
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching teacher mentorship rate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
