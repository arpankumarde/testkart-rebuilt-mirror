import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { buildTeacherSaleRowsSql } from "../../../helpers/teacherEarningsSql";
import { orderHasTeacherContentSql, paidAttemptSql } from "../../../helpers/teacherAnalyticsSql";
import { Row, get, num, date, isoDay, analyticsWindow } from "../../../helpers/teacherAnalyticsTime";
import {
  analyticsJson,
  analyticsErrorResponse,
  resolveAnalyticsTeacher,
} from "../../../helpers/teacherAnalyticsAccess";
import { schema, OutputType, AnalyticsSummaryPoint } from "./summary_GET.schema";

type Tally = { net: number; gross: number; orders: number; freeOrders: number };

const emptyTally = (): Tally => ({ net: 0, gross: 0, orders: 0, freeOrders: 0 });

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolveAnalyticsTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const window = analyticsWindow(range);
    const { previousStart, currentStart, currentStartDay } = window;
    const mine = orderHasTeacherContentSql(teacherId);

    // Everything is read across the full span (previous window start through
    // today) once, then split in JS on the current window's first day.
    const [saleRows, eventRows, trafficRows] = await Promise.all([
      sql<Row>`
        SELECT earnings, gross, sold_at, order_id
        FROM ${buildTeacherSaleRowsSql(teacherId, { start: previousStart })} sales
        WHERE sold_at IS NOT NULL
      `.execute(db),

      // Refunded orders and review ratings in one round trip. Ratings come
      // from the review rows themselves; the stored rating and review-count
      // columns on the content tables are never recalculated.
      sql<Row>`
        SELECT 'refund'::text AS event, o.created_at AS at, 0 AS rating
        FROM orders o
        WHERE o.status = 'refunded'
          AND o.created_at >= ${previousStart}
          AND (
            EXISTS (
              SELECT 1 FROM order_items oi
              LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
              LEFT JOIN courses c ON c.id = oi.course_id
              LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
              WHERE oi.order_id = o.id
                AND (mt.teacher_id = ${teacherId} OR c.teacher_id = ${teacherId} OR dp.teacher_id = ${teacherId})
            )
            OR EXISTS (
              SELECT 1 FROM course_bundles cb WHERE cb.id = o.bundle_id AND cb.teacher_id = ${teacherId}
            )
          )
        UNION ALL
        SELECT 'review'::text, r.created_at, r.rating
        FROM reviews r
        LEFT JOIN mock_tests mt ON mt.id = r.mock_test_id
        LEFT JOIN courses c ON c.id = r.course_id
        LEFT JOIN digital_products dp ON dp.id = r.digital_product_id
        WHERE r.created_at >= ${previousStart}
          AND (mt.teacher_id = ${teacherId} OR c.teacher_id = ${teacherId} OR dp.teacher_id = ${teacherId})
      `.execute(db),

      sql<Row>`
        SELECT
          count(DISTINCT se.session_id) FILTER (WHERE se.created_at >= ${currentStart}) AS visitors_current,
          count(DISTINCT se.session_id) FILTER (WHERE se.created_at < ${currentStart}) AS visitors_previous,
          count(*) FILTER (WHERE se.created_at >= ${currentStart}) AS views_current,
          count(*) FILTER (WHERE se.created_at < ${currentStart}) AS views_previous,
          (SELECT count(*) FROM orders o WHERE o.created_at >= ${currentStart} AND ${paidAttemptSql} AND ${mine}) AS attempts_current,
          (SELECT count(*) FROM orders o WHERE o.created_at >= ${previousStart} AND o.created_at < ${currentStart}
             AND ${paidAttemptSql} AND ${mine}) AS attempts_previous,
          (SELECT count(*) FROM orders o WHERE o.created_at >= ${currentStart} AND o.status IN ('completed', 'refunded')
             AND ${paidAttemptSql} AND ${mine}) AS paid_current,
          (SELECT count(*) FROM orders o WHERE o.created_at >= ${previousStart} AND o.created_at < ${currentStart}
             AND o.status IN ('completed', 'refunded') AND ${paidAttemptSql} AND ${mine}) AS paid_previous,
          (SELECT min(created_at) FROM storefront_events) AS tracking_since
        FROM storefront_events se
        WHERE se.teacher_id = ${teacherId} AND se.event_type = 'view' AND se.created_at >= ${previousStart}
      `.execute(db),
    ]);

    // An order can hold several of the teacher's items, so money is summed
    // per order first and the order is then counted once, as paid or free.
    const orders = new Map<number, { day: string; net: number; gross: number }>();
    for (const row of saleRows.rows) {
      const orderId = num(get(row, "order_id"));
      const order = orders.get(orderId) ?? {
        day: isoDay(date(get(row, "sold_at")).getTime()),
        net: 0,
        gross: 0,
      };
      order.net += num(get(row, "earnings"));
      order.gross += num(get(row, "gross"));
      orders.set(orderId, order);
    }

    const current = emptyTally();
    const previous = emptyTally();
    const byBucket = new Map<string, Tally>();
    const add = (tally: Tally, order: { net: number; gross: number }) => {
      tally.net += order.net;
      tally.gross += order.gross;
      if (order.gross > 0) tally.orders += 1;
      else tally.freeOrders += 1;
    };

    for (const order of orders.values()) {
      if (order.day >= currentStartDay) {
        add(current, order);
        const key = window.bucketOf(order.day);
        const bucket = byBucket.get(key) ?? emptyTally();
        add(bucket, order);
        byBucket.set(key, bucket);
      } else {
        add(previous, order);
      }
    }

    let refundsCurrent = 0;
    let refundsPrevious = 0;
    const ratings = { current: { sum: 0, count: 0 }, previous: { sum: 0, count: 0 } };
    for (const row of eventRows.rows) {
      const isCurrent = isoDay(date(get(row, "at")).getTime()) >= currentStartDay;
      if (get(row, "event") === "refund") {
        if (isCurrent) refundsCurrent += 1;
        else refundsPrevious += 1;
      } else {
        const side = isCurrent ? ratings.current : ratings.previous;
        side.sum += num(get(row, "rating"));
        side.count += 1;
      }
    }

    const traffic = trafficRows.rows[0] ?? {};

    const aov = (tally: Tally) => (tally.orders === 0 ? 0 : tally.gross / tally.orders);
    const rate = (refunds: number, completed: number) =>
      refunds + completed === 0 ? 0 : (refunds / (refunds + completed)) * 100;
    const average = (side: { sum: number; count: number }) => (side.count === 0 ? 0 : side.sum / side.count);

    const series: AnalyticsSummaryPoint[] = window.buckets.map((key) => {
      const bucket = byBucket.get(key);
      return {
        bucket: key,
        net: bucket?.net ?? 0,
        gross: bucket?.gross ?? 0,
        orders: bucket?.orders ?? 0,
        averageOrderValue: bucket ? aov(bucket) : 0,
      };
    });

    const output: OutputType = {
      range,
      bucket: window.bucket,
      generatedAt: new Date(),
      trackingSince: get(traffic, "tracking_since") ? date(get(traffic, "tracking_since")) : null,
      kpis: {
        net: { current: current.net, previous: previous.net },
        gross: { current: current.gross, previous: previous.gross },
        orders: { current: current.orders, previous: previous.orders },
        freeOrders: { current: current.freeOrders, previous: previous.freeOrders },
        averageOrderValue: { current: aov(current), previous: aov(previous) },
        refunds: { current: refundsCurrent, previous: refundsPrevious },
        refundRate: {
          current: rate(refundsCurrent, current.orders),
          previous: rate(refundsPrevious, previous.orders),
        },
        averageRating: { current: average(ratings.current), previous: average(ratings.previous) },
        reviews: { current: ratings.current.count, previous: ratings.previous.count },
        visitors: { current: num(get(traffic, "visitors_current")), previous: num(get(traffic, "visitors_previous")) },
        views: { current: num(get(traffic, "views_current")), previous: num(get(traffic, "views_previous")) },
        paymentAttempts: { current: num(get(traffic, "attempts_current")), previous: num(get(traffic, "attempts_previous")) },
        paymentsPaid: { current: num(get(traffic, "paid_current")), previous: num(get(traffic, "paid_previous")) },
      },
      series,
    };

    return analyticsJson(output);
  } catch (error) {
    return analyticsErrorResponse("summary", error);
  }
}