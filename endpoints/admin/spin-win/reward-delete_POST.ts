import superjson from "superjson";
import { db } from "../../../helpers/db";
import { isLiveStatus, runAdminSpin } from "../../../helpers/spinWinAdmin";
import { writeSpinAudit } from "../../../helpers/spinWinServer";
import { schema, type OutputType } from "./reward-delete_POST.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async (admin) => {
    const { id } = schema.parse(superjson.parse(await request.text()));
    await db.transaction().execute(async (trx) => {
      const reward = await trx.selectFrom("spinCampaignRewards").selectAll().where("id", "=", id).executeTakeFirst();
      if (!reward) throw new Error("Reward not found.");
      const campaign = await trx.selectFrom("spinCampaigns").select("status").where("id", "=", reward.campaignId).forUpdate().executeTakeFirstOrThrow();
      const won = await trx.selectFrom("spinRecords").select("id").where("rewardId", "=", id).limit(1).executeTakeFirst();
      if (won) throw new Error("This reward has been won, so it is kept for the records. Turn it off instead.");
      if (isLiveStatus(campaign.status) && reward.isActive) {
        throw new Error("Turn this reward off with Edit probabilities before deleting it from a live campaign.");
      }
      await writeSpinAudit(trx, { campaignId: reward.campaignId, adminId: admin.id, entity: "reward", entityId: id, action: "deleted", before: reward });
      await trx.deleteFrom("spinCampaignRewards").where("id", "=", id).execute();
    });
    const output: OutputType = { success: true };
    return output;
  });
}