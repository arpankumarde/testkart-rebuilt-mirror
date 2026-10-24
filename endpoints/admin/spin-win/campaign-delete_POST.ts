import superjson from "superjson";
import { db } from "../../../helpers/db";
import { runAdminSpin } from "../../../helpers/spinWinAdmin";
import { writeSpinAudit } from "../../../helpers/spinWinServer";
import { schema, type OutputType } from "./campaign-delete_POST.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async (admin) => {
    const { id } = schema.parse(superjson.parse(await request.text()));
    await db.transaction().execute(async (trx) => {
      const campaign = await trx.selectFrom("spinCampaigns").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
      if (!campaign) throw new Error("Campaign not found.");
      if (campaign.status !== "draft") throw new Error("Only draft campaigns can be deleted.");
      const spun = await trx.selectFrom("spinRecords").select("id").where("campaignId", "=", id).limit(1).executeTakeFirst();
      if (spun) throw new Error("This campaign has spins, so it cannot be deleted.");
      await writeSpinAudit(trx, { campaignId: null, adminId: admin.id, entity: "campaign", entityId: id, action: "deleted", before: campaign });
      await trx.deleteFrom("spinCampaigns").where("id", "=", id).execute();
    });
    const output: OutputType = { success: true };
    return output;
  });
}