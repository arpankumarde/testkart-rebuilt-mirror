import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { runAdminSpin, toAdminCampaign } from "../../../helpers/spinWinAdmin";
import { loadSpinDaily, loadSpinFinance, loadSpinStats, resolveRange } from "../../../helpers/spinWinAnalytics";
import { schema, type OutputType } from "./campaigns_GET.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async () => {
    const url = new URL(request.url);
    const input = schema.parse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const range = resolveRange(input, null);

    const rows = await db
      .selectFrom("spinCampaigns as c")
      .selectAll("c")
      .select([
        sql<string>`(SELECT count(*) FROM spin_records s WHERE s.campaign_id = c.id)`.as("spins"),
        sql<string>`(SELECT count(*) FROM spin_coupons sc WHERE sc.campaign_id = c.id)`.as("coupons"),
        sql<string>`(SELECT count(DISTINCT sc.id) FROM spin_coupons sc
          JOIN promo_code_usages u ON u.promo_code_id = sc.promo_code_id
          JOIN orders o ON o.id = u.order_id AND o.status = 'completed'
          WHERE sc.campaign_id = c.id)`.as("redeemed"),
        sql<string>`(SELECT count(*) FROM spin_campaign_rewards r WHERE r.campaign_id = c.id AND r.is_active)`.as("activeRewards"),
        sql<string>`(SELECT coalesce(sum(r.probability), 0) FROM spin_campaign_rewards r WHERE r.campaign_id = c.id AND r.is_active)`.as(
          "probabilityTotal"
        ),
      ])
      .orderBy("c.startsAt", "desc")
      .execute();

    const [stats, finance, daily] = await Promise.all([
      loadSpinStats(null, range),
      loadSpinFinance(null, range),
      loadSpinDaily(null, range),
    ]);

    const output: OutputType = {
      campaigns: rows.map((row) => ({
        ...toAdminCampaign(row),
        spins: Number(row.spins),
        coupons: Number(row.coupons),
        redeemed: Number(row.redeemed),
        activeRewards: Number(row.activeRewards),
        probabilityTotal: Number(row.probabilityTotal),
      })),
      range,
      stats,
      finance,
      daily,
    };
    return output;
  });
}