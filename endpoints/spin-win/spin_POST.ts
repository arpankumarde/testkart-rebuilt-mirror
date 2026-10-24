import superjson from "superjson";
import { db } from "../../helpers/db";
import { schema, type OutputType } from "./spin_POST.schema";
import {
  claimSpin,
  couponExpiry,
  findSpin,
  guestCookieHeader,
  newGuestSessionId,
  readGuestSessionId,
  recordSpin,
  SpinWinError,
} from "../../helpers/spinWinServer";
import { spinCampaignPhase } from "../../helpers/spinWinRules";
import { assertSpinEligible, loadCampaignBySlug, readSpinViewer, spinErrorResponse, spinViewState } from "../../helpers/spinWinViewer";

/*
 * Students and guests only. One spin per account, or per browser for guests (the cookie lasts
 * until the campaign's coupons expire). The reward is drawn and stored here,
 * before the wheel animates; repeating the request returns the stored spin. A signed-in student
 * whose browser already holds an unclaimed guest spin gets that spin claimed, not a new one.
 */
export async function handle(request: Request) {
  try {
    const { slug } = schema.parse(superjson.parse(await request.text()));
    const campaign = await loadCampaignBySlug(slug);
    if (!campaign || campaign.status === "draft") throw new SpinWinError("Campaign not found.", 404);

    const viewer = await readSpinViewer(request);
    let guestSessionId = readGuestSessionId(request);
    let setCookie: string | null = null;
    let message: string | null = null;

    assertSpinEligible(viewer);

    let spin = viewer.userId !== null ? await findSpin(db, campaign.id, { userId: viewer.userId }) : undefined;
    let alreadySpun = !!spin;

    if (!spin && guestSessionId) {
      const guestSpin = await findSpin(db, campaign.id, { guestSessionId });
      if (guestSpin && viewer.userId === null) {
        spin = guestSpin;
        alreadySpun = true;
      } else if (guestSpin && guestSpin.claimStatus === "unclaimed" && viewer.userId !== null) {
        const outcome = await claimSpin(campaign, guestSpin.id, viewer.userId);
        if (outcome.kind === "forfeited") throw new SpinWinError(outcome.message, 409);
        spin = outcome.spin;
        alreadySpun = true;
        message = "Your earlier spin has been added to your account.";
      }
    }

    if (!spin) {
      if (spinCampaignPhase(campaign) !== "active") throw new SpinWinError("This campaign is not live right now.", 409);
      if (viewer.userId === null) {
        if (!campaign.allowGuestSpins || campaign.loginRequiredToSpin) throw new SpinWinError("Log in to spin.", 401);
        if (!guestSessionId) {
          guestSessionId = newGuestSessionId();
          setCookie = guestCookieHeader(guestSessionId, couponExpiry(campaign));
        }
      }
      const recorded = await recordSpin(
        campaign,
        viewer.userId !== null ? { userId: viewer.userId } : { guestSessionId: guestSessionId! }
      );
      spin = recorded.spin;
      alreadySpun = !recorded.created;
      if (viewer.userId !== null && spin.claimStatus === "unclaimed") {
        const outcome = await claimSpin(campaign, spin.id, viewer.userId);
        if (outcome.kind === "claimed") spin = outcome.spin;
      }
    }

    const output: OutputType = { spin: await spinViewState(spin, viewer.userId), alreadySpun, message };
    const response = new Response(superjson.stringify(output), { headers: { "Cache-Control": "no-store" } });
    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
  } catch (error) {
    return spinErrorResponse(error, "Failed to spin");
  }
}