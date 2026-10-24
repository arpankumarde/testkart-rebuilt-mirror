import superjson from "superjson";
import { db } from "../../helpers/db";
import { schema, type OutputType } from "./claim_POST.schema";
import { claimSpin, findSpin, readGuestSessionId, SpinWinError } from "../../helpers/spinWinServer";
import { loadCampaignBySlug, readSpinViewer, spinErrorResponse, spinViewState } from "../../helpers/spinWinViewer";

/* Claims the account's own unclaimed spin, else this browser's guest spin. Safe to repeat. */
export async function handle(request: Request) {
  try {
    const { slug } = schema.parse(superjson.parse(await request.text()));
    const viewer = await readSpinViewer(request);
    if (viewer.userId === null) throw new SpinWinError("Log in to claim your reward.", 401);
    if (viewer.role !== "student") throw new SpinWinError("Only student accounts can claim rewards.", 403);

    const campaign = await loadCampaignBySlug(slug);
    if (!campaign || campaign.status === "draft") throw new SpinWinError("Campaign not found.", 404);

    const accountSpin = await findSpin(db, campaign.id, { userId: viewer.userId });
    const guestSessionId = readGuestSessionId(request);
    const guestSpin = guestSessionId ? await findSpin(db, campaign.id, { guestSessionId }) : undefined;
    // An unclaimed guest spin goes through claimSpin even when the account has spun, so it is
    // recorded as forfeited instead of lingering as a second entitlement.
    const pendingGuestSpin = guestSpin && guestSpin.claimStatus === "unclaimed" && guestSpin.id !== accountSpin?.id ? guestSpin : undefined;
    const target = pendingGuestSpin ?? accountSpin;
    if (!target) throw new SpinWinError("There is no reward to claim.", 404);

    const outcome = await claimSpin(campaign, target.id, viewer.userId);
    const output: OutputType =
      outcome.kind === "forfeited"
        ? {
            spin: accountSpin ? await spinViewState(accountSpin, viewer.userId) : null,
            forfeited: true,
            message: outcome.message,
          }
        : { spin: await spinViewState(outcome.spin, viewer.userId), forfeited: false, message: null };
    return new Response(superjson.stringify(output), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return spinErrorResponse(error, "Failed to claim the reward");
  }
}