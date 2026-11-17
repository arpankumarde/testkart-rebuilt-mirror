import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./rate_POST.schema";
import { minClassPrice, pricesMeetFloors, resolveLivePrices } from "../../../helpers/livePricing";
import { FULL_SESSION_MINUTES, SHORT_SESSION_MINUTES } from "../../../helpers/liveLessonConfig";
import superjson from "superjson";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") return fail("Only teachers can set this.", 403);
    if (user.role === "teacher" && user.teacherRole === "manager") return fail("Only the account owner can change 1:1 pricing.", 403);

    const input = schema.parse(superjson.parse(await request.text()));

    if (input.enabled) {
      const row = await db.selectFrom("teachers").select("liveTeachingStatus").where("id", "=", effectiveTeacherId).executeTakeFirst();
      if (row?.liveTeachingStatus !== "approved") {
        return fail("1:1 sessions open once your live teaching application is approved.", 403);
      }
    }

    if (input.prices) {
      const p = input.prices;
      if (p.classShort < minClassPrice(SHORT_SESSION_MINUTES))
        return fail(`A short session must cost at least ₹${minClassPrice(SHORT_SESSION_MINUTES)}.`);
      if (p.classFull < minClassPrice(FULL_SESSION_MINUTES))
        return fail(`A full session must cost at least ₹${minClassPrice(FULL_SESSION_MINUTES)}.`);
    }

    if (input.enabled && !input.prices) {
      const current = await db
        .selectFrom("teachers")
        .select(["mentorshipRatePerUnit", "mentorshipClassPrice60", "mentorshipTrialDiscount"])
        .where("id", "=", effectiveTeacherId)
        .executeTakeFirst();
      const resolved = current ? resolveLivePrices(current) : null;
      if (!resolved || !pricesMeetFloors(resolved)) {
        return fail(`Set your class prices to enable 1:1 sessions.`);
      }
    }

    await db
      .updateTable("teachers")
      .set({
        mentorshipEnabled: input.enabled,
        ...(input.prices
          ? {
              mentorshipRatePerUnit: input.prices.classShort.toFixed(2),
              mentorshipClassPrice60: input.prices.classFull.toFixed(2),
              mentorshipTrialDiscount: input.prices.trialDiscount,
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
