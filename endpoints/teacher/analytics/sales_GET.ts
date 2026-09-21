import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { buildTeacherSaleRowsSql } from "../../../helpers/teacherEarningsSql";
import { Row, get, num, str, date, isoDay, analyticsWindow } from "../../../helpers/teacherAnalyticsTime";
import {
  analyticsJson,
  analyticsErrorResponse,
  resolveAnalyticsTeacher,
} from "../../../helpers/teacherAnalyticsAccess";
import { TeacherMixKind, TeacherMixKindValues } from "../dashboard/overview_GET.schema";
import {
  schema,
  OutputType,
  AnalyticsSalesPoint,
  AnalyticsKindTotal,
  AnalyticsCouponSide,
  AnalyticsTopCode,
} from "./sales_GET.schema";

const TOP_CODES = 5;

type Order = {
  day: string;
  gross: number;
  net: number;
  discount: number;
  promoCodeId: number | null;
  code: string | null;
  ownCode: boolean;
};

const emptySide = (): AnalyticsCouponSide => ({ orders: 0, gross: 0, net: 0, discount: 0 });

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolveAnalyticsTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const window = analyticsWindow(range);

    const saleRows = await sql<Row>`
      SELECT sales.earnings, sales.gross, sales.discount, sales.sold_at, sales.order_id, sales.kind,
             sales.promo_code_id, pc.code::text AS code,
             (pc.created_by_teacher_id = ${teacherId}) AS own_code
      FROM ${buildTeacherSaleRowsSql(teacherId, { start: window.currentStart })} sales
      LEFT JOIN promo_codes pc ON pc.id = sales.promo_code_id
      WHERE sales.sold_at IS NOT NULL
    `.execute(db);

    const kinds = new Map<TeacherMixKind, AnalyticsKindTotal>(
      TeacherMixKindValues.map((kind) => [kind, { kind, gross: 0, net: 0, paidUnits: 0, freeUnits: 0 }])
    );
    const orders = new Map<number, Order>();

    for (const row of saleRows.rows) {
      const gross = num(get(row, "gross"));
      const net = num(get(row, "earnings"));
      const rawKind = str(get(row, "kind")) as TeacherMixKind;
      const kind = kinds.get(rawKind) ?? kinds.get("mock_test")!;
      kind.gross += gross;
      kind.net += net;
      if (gross > 0) kind.paidUnits += 1;
      else kind.freeUnits += 1;

      const orderId = num(get(row, "order_id"));
      const promoCodeId = get(row, "promo_code_id");
      const code = get(row, "code");
      const order: Order = orders.get(orderId) ?? {
        day: isoDay(date(get(row, "sold_at")).getTime()),
        gross: 0,
        net: 0,
        discount: 0,
        promoCodeId: promoCodeId === null || promoCodeId === undefined ? null : num(promoCodeId),
        code: code ? str(code) : null,
        ownCode: get(row, "own_code") === true,
      };
      order.gross += gross;
      order.net += net;
      order.discount += num(get(row, "discount"));
      orders.set(orderId, order);
    }

    const byBucket = new Map<string, AnalyticsSalesPoint>();
    const withCode = emptySide();
    const withoutCode = emptySide();
    const codes = new Map<number, AnalyticsTopCode>();
    let redemptions = 0;
    let codeDiscount = 0;
    const totals = { gross: 0, net: 0, fee: 0, orders: 0 };

    for (const order of orders.values()) {
      const key = window.bucketOf(order.day);
      const point = byBucket.get(key) ?? { bucket: key, gross: 0, net: 0, fee: 0, orders: 0 };
      point.gross += order.gross;
      point.net += order.net;
      if (order.gross > 0) point.orders += 1;
      byBucket.set(key, point);

      totals.gross += order.gross;
      totals.net += order.net;
      if (order.gross > 0) totals.orders += 1;

      if (order.promoCodeId !== null) {
        redemptions += 1;
        codeDiscount += order.discount;
        const entry = codes.get(order.promoCodeId) ?? {
          code: order.code ?? "Removed code",
          ownCode: order.ownCode,
          redemptions: 0,
          gross: 0,
          discount: 0,
        };
        entry.redemptions += 1;
        entry.gross += order.gross;
        entry.discount += order.discount;
        codes.set(order.promoCodeId, entry);
      }

      if (order.gross > 0) {
        const side = order.promoCodeId !== null ? withCode : withoutCode;
        side.orders += 1;
        side.gross += order.gross;
        side.net += order.net;
        side.discount += order.discount;
      }
    }
    totals.fee = totals.gross - totals.net;

    const series: AnalyticsSalesPoint[] = window.buckets.map((key) => {
      const point = byBucket.get(key) ?? { bucket: key, gross: 0, net: 0, fee: 0, orders: 0 };
      return { ...point, fee: point.gross - point.net };
    });

    const topCodes = [...codes.values()]
      .sort((a, b) => b.redemptions - a.redemptions || b.gross - a.gross)
      .slice(0, TOP_CODES);

    const output: OutputType = {
      range,
      bucket: window.bucket,
      generatedAt: new Date(),
      totals,
      series,
      byKind: [...kinds.values()],
      coupons: { redemptions, discount: codeDiscount, paidWithCode: withCode, paidWithoutCode: withoutCode, topCodes },
    };

    return analyticsJson(output);
  } catch (error) {
    return analyticsErrorResponse("sales", error);
  }
}