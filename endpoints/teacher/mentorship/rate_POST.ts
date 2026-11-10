import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./rate_POST.schema";
import { MENTORSHIP_MIN_RATE_PER_UNIT } from "../../../helpers/liveLessonConfig";
import { minClassPrice } from "../../../helpers/livePricing";
import superjson from "superjson";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") return fail("Only teachers can set this.", 403);
    if (user.role === "teacher" && user.teacherRole === "manager") return fail("Only the account owner can change 1:1 pricing.", 403);

    const input = schema.parse(superjson.parse(await request.text()));

    if (input.enabled) {
      const row = await db.selectFrom("users").select("liveTeachingStatus").where("id", "=", effectiveTeacherId).executeTakeFirst();
      if (row?.liveTeachingStatus !== "approved") {
        return fail("1:1 sessions open once your live teaching application is approved.", 403);
      }
    }

    if (input.prices) {
      const p = input.prices;
      if (p.class25 < minClassPrice(25)) return fail(`A 25-minute class must cost at least ₹${minClassPrice(25)}.`);
      if (p.class50 < minClassPrice(50)) return fail(`A 50-minute class must cost at least ₹${minClassPrice(50)}.`);
    }

    const class25 = input.prices?.class25 ?? input.ratePerUnit;
    if (input.enabled && class25 === undefined) {
      const current = await db.selectFrom("users").select("mentorshipRatePerUnit").where("id", "=", effectiveTeacherId).executeTakeFirst();
      if (Number(current?.mentorshipRatePerUnit ?? 0) < MENTORSHIP_MIN_RATE_PER_UNIT) {
        return fail(`Set your class prices to enable 1:1 sessions.`);
      }
    }

    await db
      .updateTable("users")
      .set({
        mentorshipEnabled: input.enabled,
        ...(class25 !== undefined ? { mentorshipRatePerUnit: class25.toFixed(2) } : {}),
        ...(input.prices
          ? {
              mentorshipClassPrice50: input.prices.class50.toFixed(2),
              mentorshipTrialPrice25: input.prices.trial25.toFixed(2),
              mentorshipTrialPrice50: input.prices.trial50.toFixed(2),
            }
          : {}),
      })
      .where("id", "=", effectiveTeacherId)
      .execute();

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error setting teacher mentorship rate:", error);
    return fail(error instanceof Error ? error.message : "An unknown error occurred");
  }
}
