import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { effectiveRenewalAmount } from "../../../helpers/subscriptionPromoCodes";
import { OutputType, MandateAdminRow, MandateStats, MandatePlanBreakdownItem } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const rows = await db
      .selectFrom("teacherSubscriptions as ts")
      .innerJoin("users as u", "u.id", "ts.teacherId")
      .innerJoin("subscriptionPlans as sp", "sp.id", "ts.planId")
      .leftJoin("promoCodes as pc", "pc.id", "ts.promoCodeId")
      .where("ts.mandateId", "is not", null)
      .select([
        "ts.id as subscriptionId",
        "ts.teacherId",
        "u.displayName as teacherName",
        "u.email as teacherEmail",
        "ts.planId",
        "sp.name as planName",
        "sp.price as planPrice",
        "ts.status",
        "ts.autoRenew",
        "ts.mandateId",
        "ts.mandateStatus",
        "ts.mandateMaxAmount",
        "ts.mandateFrequency",
        "ts.mandatePaymentMode",
        "ts.mandateStartDate",
        "ts.mandateEndDate",
        "ts.lastChargeDate",
        "ts.nextChargeDate",
        "ts.preDebitSentAt",
        "ts.promoCodeId",
        "pc.code as promoCode",
        "ts.promoDuration",
        "ts.promoDiscountAmount",
        "ts.platformFeeOverride",
        "ts.adminNote",
        sql<string | null>`(SELECT st.status::text FROM subscription_transactions st WHERE st.subscription_id = ts.id ORDER BY st.transaction_date DESC LIMIT 1)`.as(
          "lastTransactionStatus"
        ),
        sql<Date | null>`(SELECT st.transaction_date FROM subscription_transactions st WHERE st.subscription_id = ts.id ORDER BY st.transaction_date DESC LIMIT 1)`.as(
          "lastTransactionDate"
        ),
        sql<string | null>`(SELECT COALESCE(st.payment_error_message, st.notes) FROM subscription_transactions st WHERE st.subscription_id = ts.id ORDER BY st.transaction_date DESC LIMIT 1)`.as(
          "lastTransactionError"
        ),
      ])
      .orderBy("ts.nextChargeDate", "asc")
      .execute();

    const mandates: MandateAdminRow[] = rows.map((r) => {
      const planPrice = Number(r.planPrice);
      const effectiveChargeAmount = effectiveRenewalAmount({
        price: r.planPrice,
        promoDuration: r.promoDuration,
        promoDiscountAmount: r.promoDiscountAmount,
      });
      return {
        subscriptionId: r.subscriptionId,
        teacherId: r.teacherId,
        teacherName: r.teacherName,
        teacherEmail: r.teacherEmail,
        planId: r.planId,
        planName: r.planName,
        planPrice,
        status: r.status,
        autoRenew: !!r.autoRenew,
        mandateId: r.mandateId as string,
        mandateStatus: r.mandateStatus,
        mandateMaxAmount: r.mandateMaxAmount !== null ? Number(r.mandateMaxAmount) : null,
        mandateFrequency: r.mandateFrequency,
        mandatePaymentMode: r.mandatePaymentMode,
        mandateStartDate: r.mandateStartDate,
        mandateEndDate: r.mandateEndDate,
        lastChargeDate: r.lastChargeDate,
        nextChargeDate: r.nextChargeDate,
        preDebitSentAt: r.preDebitSentAt,
        promoCodeId: r.promoCodeId,
        promoCode: r.promoCode,
        promoDuration: r.promoDuration,
        promoDiscountAmount: r.promoDiscountAmount !== null ? Number(r.promoDiscountAmount) : null,
        effectiveChargeAmount,
        platformFeeOverride: r.platformFeeOverride !== null ? Number(r.platformFeeOverride) : null,
        adminNote: r.adminNote,
        lastTransactionStatus: r.lastTransactionStatus,
        lastTransactionDate: r.lastTransactionDate,
        lastTransactionError: r.lastTransactionError,
      };
    });

    // --- Stats, computed in JS since the mandate list is small (one row per live/past mandate). ---
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const statusCounts: Record<string, number> = {};
    const paymentModeCounts: Record<string, number> = {};
    const frequencyCounts: Record<string, number> = {};
    let dueWithin7Days = 0;
    let dueWithin30Days = 0;
    let overdue = 0;
    let failedLastCharge = 0;
    let activeEveryMonthPromoCount = 0;
    let activeFirstMonthPromoCount = 0;
    let monthlyRecurringDiscountTotal = 0;
    const planMap = new Map<number, MandatePlanBreakdownItem>();

    for (const m of mandates) {
      const statusKey = m.mandateStatus ?? "unknown";
      statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1;

      const modeKey = m.mandatePaymentMode ?? "unknown";
      paymentModeCounts[modeKey] = (paymentModeCounts[modeKey] ?? 0) + 1;

      const freqKey = m.mandateFrequency ?? "unknown";
      frequencyCounts[freqKey] = (frequencyCounts[freqKey] ?? 0) + 1;

      const isLiveMandate = m.mandateStatus === "active" && m.status === "active" && m.autoRenew;

      if (isLiveMandate && m.nextChargeDate) {
        const nc = new Date(m.nextChargeDate);
        if (nc < now) overdue++;
        else if (nc <= in7) dueWithin7Days++;
        else if (nc <= in30) dueWithin30Days++;
      }

      if (isLiveMandate && m.lastTransactionStatus === "failed") {
        failedLastCharge++;
      }

      if (m.status === "active") {
        if (m.promoDuration === "every_month" && m.promoDiscountAmount !== null) {
          activeEveryMonthPromoCount++;
          monthlyRecurringDiscountTotal += m.promoDiscountAmount;
        } else if (m.promoDuration === "first_month") {
          activeFirstMonthPromoCount++;
        }
      }

      if (isLiveMandate) {
        const entry =
          planMap.get(m.planId) ??
          ({ planId: m.planId, planName: m.planName, activeMandateCount: 0, estimatedMrr: 0 } satisfies MandatePlanBreakdownItem);
        entry.activeMandateCount++;
        entry.estimatedMrr += m.effectiveChargeAmount;
        planMap.set(m.planId, entry);
      }
    }

    const discountTotalRow = await db
      .selectFrom("subscriptionTransactions")
      .where("paymentMethod", "=", "payu_recurring")
      .where("discountAmount", "is not", null)
      .select(sql<string>`COALESCE(SUM(discount_amount), 0)`.as("total"))
      .executeTakeFirst();

    const stats: MandateStats = {
      totalMandates: mandates.length,
      statusCounts,
      paymentModeCounts,
      frequencyCounts,
      dueWithin7Days,
      dueWithin30Days,
      overdue,
      failedLastCharge,
      activeEveryMonthPromoCount,
      activeFirstMonthPromoCount,
      monthlyRecurringDiscountTotal: Math.round(monthlyRecurringDiscountTotal * 100) / 100,
      totalDiscountGivenAllTime: discountTotalRow ? Number(discountTotalRow.total) : 0,
      planBreakdown: Array.from(planMap.values()).sort((a, b) => b.estimatedMrr - a.estimatedMrr),
    };

    const output: OutputType = { mandates, stats };
    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching admin mandates:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to load mandates" }),
      { status: 400 }
    );
  }
}
