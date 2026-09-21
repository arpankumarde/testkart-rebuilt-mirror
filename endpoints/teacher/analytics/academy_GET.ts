import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { buildTeacherSaleRowsSql } from "../../../helpers/teacherEarningsSql";
import { orderHasTeacherContentSql, paidAttemptSql } from "../../../helpers/teacherAnalyticsSql";
import { IST, Row, get, num, str, analyticsWindow } from "../../../helpers/teacherAnalyticsTime";
import {
  analyticsJson,
  analyticsErrorResponse,
  resolveAnalyticsTeacher,
} from "../../../helpers/teacherAnalyticsAccess";
import { schema, OutputType, AcademyMetrics, AcademyBreakdown } from "./academy_GET.schema";

const emptyMetrics = (): AcademyMetrics => ({ views: 0, visitors: 0, carts: 0, shares: 0, converted: 0 });

const readMetrics = (row: Row): AcademyMetrics => ({
  views: num(get(row, "views")),
  visitors: num(get(row, "visitors")),
  carts: num(get(row, "carts")),
  shares: num(get(row, "shares")),
  converted: num(get(row, "converted")),
});

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolveAnalyticsTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const window = analyticsWindow(range);
    const bucketFormat = window.bucket === "month" ? "YYYY-MM" : "YYYY-MM-DD";

    const metrics = sql`
      count(*) FILTER (WHERE event_type = 'view') AS views,
      count(DISTINCT session_id) FILTER (WHERE event_type = 'view') AS visitors,
      count(DISTINCT session_id) FILTER (WHERE event_type = 'add_to_cart') AS carts,
      count(*) FILTER (WHERE event_type = 'share') AS shares,
      count(DISTINCT user_id) FILTER (WHERE event_type = 'view' AND user_id IN (SELECT buyer_id FROM buyers)) AS converted
    `;

    const mine = orderHasTeacherContentSql(teacherId);

    const [eventRows, totalRows] = await Promise.all([
      // Distinct visitors cannot be added up across groups, so each breakdown
      // is its own GROUP BY over the same events, returned as (dim, period, key).
      sql<Row>`
        WITH ev AS (
          SELECT event_type, entity_type, source, coalesce(device, 'unknown') AS device, platform,
                 utm_campaign, session_id, user_id,
                 (created_at >= ${window.currentStart}) AS cur,
                 to_char((created_at AT TIME ZONE ${IST})::date, ${bucketFormat}) AS bucket
          FROM storefront_events
          WHERE teacher_id = ${teacherId} AND created_at >= ${window.previousStart}
        ),
        buyers AS (
          SELECT DISTINCT buyer_id FROM ${buildTeacherSaleRowsSql(teacherId, { start: window.currentStart })} sales
          WHERE buyer_id IS NOT NULL
        )
        SELECT 'total'::text AS dim, (CASE WHEN cur THEN 'cur' ELSE 'prev' END)::text AS period, NULL::text AS key, ${metrics}
        FROM ev GROUP BY 2
        UNION ALL
        SELECT 'bucket', 'cur', bucket, ${metrics} FROM ev WHERE cur GROUP BY bucket
        UNION ALL
        SELECT 'entity', 'cur', entity_type, ${metrics} FROM ev WHERE cur GROUP BY entity_type
        UNION ALL
        SELECT 'source', 'cur', source, ${metrics} FROM ev WHERE cur AND event_type <> 'share' GROUP BY source
        UNION ALL
        SELECT 'device', 'cur', device, ${metrics} FROM ev WHERE cur AND event_type <> 'share' GROUP BY device
        UNION ALL
        SELECT 'campaign', 'cur', utm_campaign, ${metrics}
        FROM ev WHERE cur AND event_type = 'view' AND utm_campaign IS NOT NULL GROUP BY utm_campaign
        UNION ALL
        SELECT 'share_platform', 'cur', platform, ${metrics} FROM ev WHERE cur AND event_type = 'share' GROUP BY platform
        UNION ALL
        SELECT 'share_campaign', 'cur', coalesce(utm_campaign, 'other'), ${metrics}
        FROM ev WHERE cur AND event_type = 'share' GROUP BY 3
      `.execute(db),

      sql<Row>`
        SELECT
          (SELECT count(DISTINCT o.user_id) FROM orders o
             WHERE o.created_at >= ${window.currentStart} AND ${paidAttemptSql} AND ${mine}) AS started_payment,
          (SELECT count(DISTINCT o.user_id) FROM orders o
             WHERE o.created_at >= ${window.currentStart} AND o.status IN ('completed', 'refunded')
               AND ${paidAttemptSql} AND ${mine}) AS paid,
          (SELECT min(created_at) FROM storefront_events) AS tracking_since,
          (SELECT coalesce(sum(views), 0) FROM mock_tests
             WHERE teacher_id = ${teacherId} AND deleted_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.mock_test_id = mock_tests.id)) AS mock_test_views,
          (SELECT coalesce(sum(view_count), 0) FROM live_tests WHERE teacher_id = ${teacherId}) AS live_test_views,
          (SELECT coalesce(sum(views), 0) FROM courses WHERE teacher_id = ${teacherId}) AS course_views,
          (SELECT coalesce(sum(views), 0) FROM digital_products WHERE teacher_id = ${teacherId}) AS digital_product_views
      `.execute(db),
    ]);

    let current = emptyMetrics();
    let previous = emptyMetrics();
    const byBucket = new Map<string, AcademyMetrics>();
    const groups: Record<string, AcademyBreakdown[]> = {
      entity: [],
      source: [],
      device: [],
      campaign: [],
      share_platform: [],
      share_campaign: [],
    };

    for (const row of eventRows.rows) {
      const dim = str(get(row, "dim"));
      const values = readMetrics(row);
      if (dim === "total") {
        if (get(row, "period") === "cur") current = values;
        else previous = values;
      } else if (dim === "bucket") {
        byBucket.set(str(get(row, "key")), values);
      } else if (groups[dim]) {
        groups[dim].push({ key: str(get(row, "key"), "unknown"), ...values });
      }
    }

    const byVisitors = (list: AcademyBreakdown[]) =>
      list.sort((a, b) => b.visitors - a.visitors || b.views - a.views);
    const byShares = (list: AcademyBreakdown[]) => list.sort((a, b) => b.shares - a.shares);

    const t = totalRows.rows[0] ?? {};
    const trackingSince = get(t, "tracking_since");

    const output: OutputType = {
      range,
      bucket: window.bucket,
      generatedAt: new Date(),
      trackingSince: trackingSince ? new Date(str(trackingSince)) : null,
      current,
      previous,
      series: window.buckets.map((key) => ({
        bucket: key,
        views: byBucket.get(key)?.views ?? 0,
        visitors: byBucket.get(key)?.visitors ?? 0,
      })),
      byEntity: byVisitors(groups.entity),
      sources: byVisitors(groups.source),
      devices: byVisitors(groups.device),
      campaigns: byVisitors(groups.campaign),
      sharePlatforms: byShares(groups.share_platform),
      shareCampaigns: byShares(groups.share_campaign),
      funnel: {
        visitors: current.visitors,
        addedToCart: current.carts,
        startedPayment: num(get(t, "started_payment")),
        paid: num(get(t, "paid")),
      },
      lifetimeViews: {
        mock_test: num(get(t, "mock_test_views")),
        live_test: num(get(t, "live_test_views")),
        course: num(get(t, "course_views")),
        digital_product: num(get(t, "digital_product_views")),
      },
    };

    return analyticsJson(output);
  } catch (error) {
    return analyticsErrorResponse("academy", error);
  }
}