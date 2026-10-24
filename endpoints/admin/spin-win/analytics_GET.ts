import { runAdminSpin, loadCampaignOrThrow } from "../../../helpers/spinWinAdmin";
import {
  costByRewardType,
  loadSpinDaily,
  loadSpinFinance,
  loadSpinRewardRows,
  loadSpinStats,
  resolveRange,
} from "../../../helpers/spinWinAnalytics";
import { schema, type OutputType } from "./analytics_GET.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async () => {
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const campaign = input.campaignId ? await loadCampaignOrThrow(input.campaignId) : null;
    const campaignId = campaign?.id ?? null;
    const range = resolveRange(input, campaign);
    const [stats, finance, daily, rewards] = await Promise.all([
      loadSpinStats(campaignId, range),
      loadSpinFinance(campaignId, range),
      loadSpinDaily(campaignId, range),
      loadSpinRewardRows(campaignId, range),
    ]);
    const output: OutputType = {
      range,
      stats,
      finance,
      daily,
      rewards,
      typeCosts: costByRewardType(rewards),
      discountFunding: campaign?.discountFunding ?? null,
    };
    return output;
  });
}