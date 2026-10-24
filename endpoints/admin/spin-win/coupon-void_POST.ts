import superjson from "superjson";
import { db } from "../../../helpers/db";
import { runAdminSpin } from "../../../helpers/spinWinAdmin";
import { writeSpinAudit } from "../../../helpers/spinWinServer";
import { schema, type OutputType } from "./coupon-void_POST.schema";

/*
 * The only change an admin can make to an issued coupon: withdraw it (for abuse, say). Its
 * reward, value and limits are never editable, and a redeemed coupon cannot be voided.
 */
export async function handle(request: Request) {
  return runAdminSpin(request, async (admin) => {
    const { id, reason } = schema.parse(superjson.parse(await request.text()));
    await db.transaction().execute(async (trx) => {
      const coupon = await trx.selectFrom("spinCoupons").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
      if (!coupon) throw new Error("Coupon not found.");
      if (coupon.voidedAt) throw new Error("This coupon is already void.");
      const used = await trx
        .selectFrom("promoCodeUsages as u")
        .innerJoin("orders as o", "o.id", "u.orderId")
        .select("o.id")
        .where("u.promoCodeId", "=", coupon.promoCodeId)
        .where("o.status", "in", ["completed", "refunded", "pending"])
        .executeTakeFirst();
      if (used) throw new Error("This coupon has already gone into an order, so it cannot be voided.");
      const voidedAt = new Date();
      await trx.updateTable("spinCoupons").set({ voidedAt, voidedReason: reason, voidedByAdminId: admin.id }).where("id", "=", id).execute();
      await trx.updateTable("promoCodes").set({ isActive: false, updatedAt: voidedAt }).where("id", "=", coupon.promoCodeId).execute();
      await writeSpinAudit(trx, {
        campaignId: coupon.campaignId,
        adminId: admin.id,
        entity: "coupon",
        entityId: id,
        action: "voided",
        after: { reason },
      });
    });
    const output: OutputType = { success: true };
    return output;
  });
}