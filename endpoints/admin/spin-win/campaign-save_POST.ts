import superjson from "superjson";
import { db } from "../../../helpers/db";
import { isLiveStatus, runAdminSpin, toAdminCampaign, toAdminReward } from "../../../helpers/spinWinAdmin";
import { writeSpinAudit } from "../../../helpers/spinWinServer";
import { DIWALI_REWARD_PRESETS, rewardTermsProblems, SPIN_SEGMENT_COLORS } from "../../../helpers/spinWinRules";
import { schema, type OutputType } from "./campaign-save_POST.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async (admin) => {
    const input = schema.parse(superjson.parse(await request.text()));
    const { id, seedDiwaliPresets, ...fields } = input;

    const clash = await db.selectFrom("spinCampaigns").select("id").where("slug", "=", fields.slug).executeTakeFirst();
    if (clash && clash.id !== id) throw new Error("Another campaign already uses this slug.");

    const values = { ...fields, maxDiscountPercent: String(fields.maxDiscountPercent) };

    const saved = await db.transaction().execute(async (trx) => {
      if (id === undefined) {
        const created = await trx
          .insertInto("spinCampaigns")
          .values({ ...values, status: "draft", createdByAdminId: admin.id, updatedByAdminId: admin.id })
          .returningAll()
          .executeTakeFirstOrThrow();
        if (seedDiwaliPresets) {
          await trx
            .insertInto("spinCampaignRewards")
            .values(
              DIWALI_REWARD_PRESETS.map((preset, index) => ({
                campaignId: created.id,
                name: preset.name,
                rewardType: preset.rewardType,
                discountType: preset.discountType,
                discountValue: preset.discountValue === null ? null : String(preset.discountValue),
                wheelLabel: preset.wheelLabel,
                segmentColor: SPIN_SEGMENT_COLORS[index % SPIN_SEGMENT_COLORS.length],
                icon: preset.icon,
                minOrderValue: preset.minOrderValue === null ? null : String(preset.minOrderValue),
                probability: "0",
                isActive: false,
                sortOrder: index,
              }))
            )
            .execute();
        }
        await writeSpinAudit(trx, {
          campaignId: created.id,
          adminId: admin.id,
          entity: "campaign",
          entityId: created.id,
          action: seedDiwaliPresets ? "created_with_diwali_presets" : "created",
          after: created,
        });
        return created;
      }

      const before = await trx.selectFrom("spinCampaigns").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
      if (!before) throw new Error("Campaign not found.");
      if (before.status !== "draft" && before.slug !== fields.slug) {
        throw new Error("The slug is locked once a campaign has been published, so shared links keep working.");
      }
      if (before.discountFunding === "platform_funded" && fields.discountFunding !== "platform_funded") {
        const paid = await trx
          .selectFrom("spinCoupons")
          .innerJoin("orders", "orders.promoCodeId", "spinCoupons.promoCodeId")
          .select((eb) => eb.fn.countAll<string>().as("count"))
          .where("spinCoupons.campaignId", "=", id)
          .where("orders.status", "=", "completed")
          .executeTakeFirst();
        if (Number(paid?.count ?? 0) > 0) {
          throw new Error(
            "Teachers are already paid the full price on orders from this campaign, so discount funding cannot go back to shared."
          );
        }
      }
      const updated = await trx
        .updateTable("spinCampaigns")
        .set({ ...values, updatedByAdminId: admin.id, updatedAt: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (isLiveStatus(updated.status)) {
        const active = await trx.selectFrom("spinCampaignRewards").selectAll().where("campaignId", "=", id).where("isActive", "=", true).execute();
        const broken = active.flatMap((row) =>
          rewardTermsProblems(toAdminReward(row), fields.maxDiscountPercent).map((p) => `${row.name}: ${p}`)
        );
        if (broken.length > 0) throw new Error(`These settings would break live rewards. ${broken.join(" ")}`);
      }
      await writeSpinAudit(trx, { campaignId: id, adminId: admin.id, entity: "campaign", entityId: id, action: "updated", before, after: updated });
      return updated;
    });

    const output: OutputType = { campaign: toAdminCampaign(saved) };
    return output;
  });
}