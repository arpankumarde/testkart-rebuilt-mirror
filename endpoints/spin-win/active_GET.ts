import superjson from "superjson";
import type { OutputType } from "./active_GET.schema";
import { couponExpiry, guestCookieHeader, readGuestSessionId } from "../../helpers/spinWinServer";
import { buildCampaignView, isSpinEligible, loadActiveCampaign, readSpinViewer, spinErrorResponse } from "../../helpers/spinWinViewer";

/* Teachers and admins get no campaign at all. A guest's cookie is re-sent with the campaign's expiry. */
export async function handle(request: Request) {
  try {
    const viewer = await readSpinViewer(request);
    const campaign = isSpinEligible(viewer) ? await loadActiveCampaign() : undefined;
    const output: OutputType = { active: campaign ? await buildCampaignView(campaign, request, viewer) : null };
    const response = new Response(superjson.stringify(output), { headers: { "Cache-Control": "no-store" } });
    const guestSessionId = readGuestSessionId(request);
    if (campaign && guestSessionId) response.headers.append("Set-Cookie", guestCookieHeader(guestSessionId, couponExpiry(campaign)));
    return response;
  } catch (error) {
    return spinErrorResponse(error, "Failed to load the campaign");
  }
}
