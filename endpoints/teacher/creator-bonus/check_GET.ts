import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import {
  campaignAmount,
  campaignRequirements,
  checkClaimable,
  getActiveCampaign,
} from "../../../helpers/teacherCampaign";
import { campaignProgress } from "../../../helpers/teacherCampaignRules";
import { schema, type OutputType } from "./check_GET.schema";

/* Whether the submit dialog should offer the Creator Bonus for one item. */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ active: false } satisfies OutputType));
    }
    const url = new URL(request.url);
    const parsed = schema.safeParse({ type: url.searchParams.get("type"), id: url.searchParams.get("id") });
    if (!parsed.success) return new Response(superjson.stringify({ error: "Invalid request" }), { status: 400 });
    const { type, id } = parsed.data;

    const campaign = await getActiveCampaign(db);
    if (!campaign) return new Response(superjson.stringify({ active: false } satisfies OutputType));

    const check = await checkClaimable(db, campaign, effectiveTeacherId, type, id);
    const output: OutputType = {
      active: true,
      title: campaign.title,
      amount: campaignAmount(campaign, type),
      canClaim: check.ok,
      reason: check.ok ? null : check.reason,
      progress: check.criteria ? campaignProgress(check.criteria, campaignRequirements(campaign)) : null,
      videos: check.criteria?.kind === "course" ? check.criteria.lessons : null,
      minMinutesPerVideo: campaign.minMinutesPerVideo,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("[creator-bonus/check]", error);
    return new Response(superjson.stringify({ error: "Could not check the Creator Bonus." }), { status: 500 });
  }
}