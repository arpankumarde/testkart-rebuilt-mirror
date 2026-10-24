import superjson from "superjson";
import { db } from "../../../helpers/db";
import { loadRewards, publishProblems, runAdminSpin, toAdminCampaign } from "../../../helpers/spinWinAdmin";
import { writeSpinAudit } from "../../../helpers/spinWinServer";
import { schema, type OutputType } from "./campaign-status_POST.schema";

const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  publish: { from: ["draft"], to: "published" },
  pause: { from: ["published"], to: "paused" },
  resume: { from: ["paused"], to: "published" },
  complete: { from: ["published", "paused"], to: "completed" },
  unpublish: { from: ["published", "paused"], to: "draft" },
};

/*
 * Publishing and resuming need a valid wheel (active odds total 100%, rewards within the cap).
 * Unpublishing is only for a campaign nobody has spun yet; after that, pause or complete it.
 */
export async function handle(request: Request) {
  return runAdminSpin(request, async (admin) => {
    const { id, action } = schema.parse(superjson.parse(await request.text()));
    const updated = await db.transaction().execute(async (trx) => {
      const campaign = await trx.selectFrom("spinCampaigns").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
      if (!campaign) throw new Error("Campaign not found.");
      const rule = TRANSITIONS[action];
      if (!rule.from.includes(campaign.status)) throw new Error(`A ${campaign.status} campaign cannot be ${action}ed.`);

      if (action === "publish" || action === "resume") {
        const problems = publishProblems(campaign, await loadRewards(id));
        if (problems.length > 0) throw new Error(`Fix these first: ${problems.join(" ")}`);
      }
      if (action === "unpublish") {
        const spun = await trx.selectFrom("spinRecords").select("id").where("campaignId", "=", id).limit(1).executeTakeFirst();
        if (spun) throw new Error("Students have already spun this campaign. Pause or complete it instead.");
      }

      const row = await trx
        .updateTable("spinCampaigns")
        .set({ status: rule.to, updatedByAdminId: admin.id, updatedAt: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeSpinAudit(trx, {
        campaignId: id,
        adminId: admin.id,
        entity: "campaign",
        entityId: id,
        action,
        before: { status: campaign.status },
        after: { status: row.status },
      });
      return row;
    });
    const output: OutputType = { campaign: toAdminCampaign(updated) };
    return output;
  });
}