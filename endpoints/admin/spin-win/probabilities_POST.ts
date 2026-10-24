import superjson from "superjson";
import { db } from "../../../helpers/db";
import { isLiveStatus, runAdminSpin } from "../../../helpers/spinWinAdmin";
import { writeSpinAudit } from "../../../helpers/spinWinServer";
import { probabilityProblems, toMilli } from "../../../helpers/spinWinRules";
import { schema, type OutputType } from "./probabilities_POST.schema";

/* Rebalances every reward's odds in one transaction, so a live wheel never sits off 100%. */
export async function handle(request: Request) {
  return runAdminSpin(request, async (admin) => {
    const { campaignId, items } = schema.parse(superjson.parse(await request.text()));
    for (const item of items) {
      if (item.isActive && toMilli(item.probability) <= 0) throw new Error("A reward with a 0% chance cannot be turned on.");
    }

    await db.transaction().execute(async (trx) => {
      const campaign = await trx.selectFrom("spinCampaigns").select("status").where("id", "=", campaignId).forUpdate().executeTakeFirst();
      if (!campaign) throw new Error("Campaign not found.");
      if (campaign.status === "completed") throw new Error("Completed campaigns cannot be edited.");

      const before = await trx
        .selectFrom("spinCampaignRewards")
        .select(["id", "name", "isActive", "probability"])
        .where("campaignId", "=", campaignId)
        .execute();
      const known = new Set(before.map((r) => r.id));
      for (const item of items) if (!known.has(item.id)) throw new Error("A reward does not belong to this campaign.");

      for (const item of items) {
        await trx
          .updateTable("spinCampaignRewards")
          .set({ probability: String(item.probability), isActive: item.isActive, updatedAt: new Date() })
          .where("id", "=", item.id)
          .execute();
      }

      const after = await trx
        .selectFrom("spinCampaignRewards")
        .select(["id", "name", "isActive", "probability"])
        .where("campaignId", "=", campaignId)
        .execute();
      if (isLiveStatus(campaign.status)) {
        const problems = probabilityProblems(after);
        if (problems.length > 0) throw new Error(`This campaign is live, so the wheel must stay valid. ${problems.join(" ")}`);
      }
      await writeSpinAudit(trx, { campaignId, adminId: admin.id, entity: "reward", entityId: null, action: "probabilities_updated", before, after });
    });
    const output: OutputType = { success: true };
    return output;
  });
}