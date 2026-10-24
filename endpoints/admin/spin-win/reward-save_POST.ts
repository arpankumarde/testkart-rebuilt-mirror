import superjson from "superjson";
import { db } from "../../../helpers/db";
import { isLiveStatus, runAdminSpin, toAdminReward } from "../../../helpers/spinWinAdmin";
import { writeSpinAudit } from "../../../helpers/spinWinServer";
import { probabilityProblems, rewardTermsProblems, toMilli } from "../../../helpers/spinWinRules";
import { schema, type OutputType } from "./reward-save_POST.schema";

/*
 * Spins keep a snapshot of the reward they won, so editing a reward only changes future spins.
 * A reward's type is fixed once it has been won, to keep reporting by type honest.
 */
export async function handle(request: Request) {
  return runAdminSpin(request, async (admin) => {
    const input = schema.parse(superjson.parse(await request.text()));
    const { id, campaignId, ...fields } = input;

    if (fields.rewardType === "percentage" || fields.rewardType === "flat") {
      fields.discountType = fields.rewardType;
    }
    if (!fields.discountType) {
      fields.discountValue = null;
      fields.minOrderValue = null;
      fields.maxDiscountAmount = null;
    }
    if (fields.isActive && toMilli(fields.probability) <= 0) {
      throw new Error("A reward with a 0% chance cannot be turned on. Give it a chance first.");
    }

    const saved = await db.transaction().execute(async (trx) => {
      const campaign = await trx.selectFrom("spinCampaigns").selectAll().where("id", "=", campaignId).forUpdate().executeTakeFirst();
      if (!campaign) throw new Error("Campaign not found.");
      if (campaign.status === "completed") throw new Error("Completed campaigns cannot be edited.");

      const problems = rewardTermsProblems(fields, Number(campaign.maxDiscountPercent));
      if (problems.length > 0) throw new Error(problems.join(" "));

      const values = {
        ...fields,
        discountValue: fields.discountValue === null ? null : String(fields.discountValue),
        probability: String(fields.probability),
        minOrderValue: fields.minOrderValue === null ? null : String(fields.minOrderValue),
        maxDiscountAmount: fields.maxDiscountAmount === null ? null : String(fields.maxDiscountAmount),
      };

      let before = null;
      let row;
      if (id === undefined) {
        const next = await trx
          .selectFrom("spinCampaignRewards")
          .select((eb) => eb.fn.max("sortOrder").as("max"))
          .where("campaignId", "=", campaignId)
          .executeTakeFirst();
        row = await trx
          .insertInto("spinCampaignRewards")
          .values({ ...values, campaignId, sortOrder: fields.sortOrder ?? Number(next?.max ?? -1) + 1 })
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        before = await trx.selectFrom("spinCampaignRewards").selectAll().where("id", "=", id).where("campaignId", "=", campaignId).executeTakeFirst();
        if (!before) throw new Error("Reward not found.");
        if (before.rewardType !== fields.rewardType) {
          const won = await trx.selectFrom("spinRecords").select("id").where("rewardId", "=", id).limit(1).executeTakeFirst();
          if (won) throw new Error("This reward has already been won, so its type cannot change. Add a new reward instead.");
        }
        row = await trx
          .updateTable("spinCampaignRewards")
          .set({ ...values, sortOrder: fields.sortOrder ?? before.sortOrder, updatedAt: new Date() })
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      if (isLiveStatus(campaign.status)) {
        const all = await trx.selectFrom("spinCampaignRewards").select(["name", "isActive", "probability"]).where("campaignId", "=", campaignId).execute();
        const wheel = probabilityProblems(all);
        if (wheel.length > 0) {
          throw new Error(`This campaign is live, so the wheel must stay valid. ${wheel.join(" ")} Use Edit probabilities to rebalance in one step.`);
        }
      }

      await writeSpinAudit(trx, {
        campaignId,
        adminId: admin.id,
        entity: "reward",
        entityId: row.id,
        action: id === undefined ? "created" : "updated",
        before,
        after: row,
      });
      return row;
    });

    const output: OutputType = { reward: toAdminReward(saved) };
    return output;
  });
}