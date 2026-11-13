import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./rate_POST.schema";
import { minClassPrice, pricesMeetFloors, resolveLivePrices } from "../../../helpers/livePricing";
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
      if (p.class30 < minClassPrice(30)) return fail(`A 30-minute class must cost at least ₹${minClassPrice(30)}.`);
      if (p.class60 < minClassPrice(60)) return fail(`A 60-minute class must cost at least ₹${minClassPrice(60)}.`);
    }

    if (input.enabled && !input.prices) {
      const current = await db
        .selectFrom("users")
        .select(["mentorshipRatePerUnit", "mentorshipClassPrice60", "mentorshipTrialDiscount"])
        .where("id", "=", effectiveTeacherId)
        .executeTakeFirst();
      const resolved = current ? resolveLivePrices(current) : null;
      if (!resolved || !pricesMeetFloors(resolved)) {
        return fail(`Set your class prices to enable 1:1 sessions.`);
      }
    }

    await db
      .updateTable("users")
      .set({
        mentorshipEnabled: input.enabled,
        ...(input.prices
          ? {
              mentorshipRatePerUnit: input.prices.class30.toFixed(2),
              mentorshipClassPrice60: input.prices.class60.toFixed(2),
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
