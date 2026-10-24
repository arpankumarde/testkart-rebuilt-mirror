import superjson from "superjson";
import { schema } from "./campaign_GET.schema";
import { SpinWinError } from "../../helpers/spinWinServer";
import { assertSpinEligible, buildCampaignView, loadCampaignBySlug, readSpinViewer, spinErrorResponse } from "../../helpers/spinWinViewer";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const { slug } = schema.parse({ slug: url.searchParams.get("slug") ?? "" });
    const viewer = await readSpinViewer(request);
    assertSpinEligible(viewer);
    const campaign = await loadCampaignBySlug(slug);
    if (!campaign || campaign.status === "draft") throw new SpinWinError("Campaign not found.", 404);
    return new Response(superjson.stringify(await buildCampaignView(campaign, request, viewer)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return spinErrorResponse(error, "Failed to load the campaign");
  }
}
