import { db } from "../../../helpers/db";
import { loadCampaignOrThrow, loadRewards, publishProblems, runAdminSpin, toAdminCampaign } from "../../../helpers/spinWinAdmin";
import { activeProbabilityTotal } from "../../../helpers/spinWinRules";
import { schema, type OutputType } from "./campaign_GET.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async () => {
    const { id } = schema.parse({ id: new URL(request.url).searchParams.get("id") });
    const campaign = await loadCampaignOrThrow(id);
    const rewards = await loadRewards(id);
    const audit = await db
      .selectFrom("spinCampaignAuditLogs as l")
      .leftJoin("admins as a", "a.id", "l.adminId")
      .select(["l.id", "a.fullName as adminName", "l.entity", "l.entityId", "l.action", "l.before", "l.after", "l.createdAt"])
      .where("l.campaignId", "=", id)
      .orderBy("l.createdAt", "desc")
      .limit(100)
      .execute();

    const output: OutputType = {
      campaign: toAdminCampaign(campaign),
      rewards,
      probabilityTotal: activeProbabilityTotal(rewards),
      problems: publishProblems(campaign, rewards),
      spins: rewards.reduce((sum, r) => sum + r.spins, 0),
      audit: audit.map((row) => ({ ...row, id: String(row.id), entityId: row.entityId === null ? null : String(row.entityId) })),
    };
    return output;
  });
}