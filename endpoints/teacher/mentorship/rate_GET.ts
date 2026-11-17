import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./rate_GET.schema";
import {
  FULL_SESSION_MINUTES,
  MENTORSHIP_SESSION_DURATIONS,
  MENTORSHIP_TRIAL_DISCOUNT_PERCENT,
  SHORT_SESSION_MINUTES,
} from "../../../helpers/liveLessonConfig";
import { minClassPrice, resolveLivePrices } from "../../../helpers/livePricing";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Only teachers can view this." }), { status: 403 });
    }

    const row = await db
      .selectFrom("teachers")
      .select(["mentorshipEnabled", "mentorshipRatePerUnit", "mentorshipClassPrice60", "mentorshipTrialDiscount"])
      .where("id", "=", effectiveTeacherId)
      .executeTakeFirst();

    const prices = row ? resolveLivePrices(row) : null;
    const output: OutputType = {
      enabled: !!row?.mentorshipEnabled,
      durations: [...MENTORSHIP_SESSION_DURATIONS],
      prices,
      trialDiscount: row ? row.mentorshipTrialDiscount : true,
      minClassPriceShort: minClassPrice(SHORT_SESSION_MINUTES),
      minClassPriceFull: minClassPrice(FULL_SESSION_MINUTES),
      trialDiscountPercentShort: MENTORSHIP_TRIAL_DISCOUNT_PERCENT[SHORT_SESSION_MINUTES],
      trialDiscountPercentFull: MENTORSHIP_TRIAL_DISCOUNT_PERCENT[FULL_SESSION_MINUTES],
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching teacher mentorship rate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
