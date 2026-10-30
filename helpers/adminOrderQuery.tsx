import { sql, type RawBuilder, type SqlBool } from "kysely";
import { db } from "./db";
import { NOT_CAPTURED, type AdminOrderFilters, type AdminOrderSort } from "./adminOrderFilters";
import { orderPlatform, PAYMENT_MODE_GROUP_CODES, type OrderClientDeviceType, type OrderClientSource } from "./orderAttribution";
import { paymentFailureReason } from "./paymentFailureReason";
import { orderDiscountBreakdown } from "./orderDiscountMethod";
import type { AdminOrderRow } from "../endpoints/admin/orders/search_POST.schema";
import type { PurchasedItemDetail } from "../endpoints/admin/orders_GET.schema";

/*
 * Server side of the admin Transactions page. orderWhere() turns the page's
 * filters into one SQL condition over the orders table, and search, summary
 * and export all use it, so the three never disagree about which orders match.
 * Conditions are raw SQL against snake_case columns with every value bound as
 * a parameter; the CamelCasePlugin only rewrites builder identifiers.
 */

const ALL_MODE_CODES = Object.values(PAYMENT_MODE_GROUP_CODES).flat();

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function anyOf(conditions: RawBuilder<SqlBool>[]): RawBuilder<SqlBool> {
  if (conditions.length === 0) return sql<SqlBool>`false`;
  return sql<SqlBool>`(${sql.join(conditions, sql` or `)})`;
}

/** column IN (values) for the captured ones, plus IS NULL when NOT_CAPTURED is picked. */
function facetCondition(column: string, values: string[]): RawBuilder<SqlBool> {
  const ref = sql.raw(`orders.${column}`);
  const known = values.filter((value) => value !== NOT_CAPTURED);
  const parts: RawBuilder<SqlBool>[] = [];
  if (known.length > 0) parts.push(sql<SqlBool>`${ref} in (${sql.join(known)})`);
  if (values.includes(NOT_CAPTURED)) parts.push(sql<SqlBool>`${ref} is null`);
  return anyOf(parts);
}

const PLATFORM_CONDITIONS: Record<string, RawBuilder<SqlBool>> = {
  android_app: sql<SqlBool>`orders.client_source = 'android_app'`,
  ios_app: sql<SqlBool>`orders.client_source = 'ios_app'`,
  mobile_web: sql<SqlBool>`(orders.client_source = 'web' and orders.client_device_type = 'mobile')`,
  desktop_web: sql<SqlBool>`(orders.client_source = 'web' and orders.client_device_type = 'desktop')`,
  tablet_web: sql<SqlBool>`(orders.client_source = 'web' and orders.client_device_type = 'tablet')`,
  unknown: sql<SqlBool>`(orders.client_source is null or orders.client_source not in ('web', 'android_app', 'ios_app')
    or (orders.client_source = 'web' and coalesce(orders.client_device_type, 'unknown') not in ('mobile', 'desktop', 'tablet')))`,
};

/** The platform as a SQL expression, matching helpers/orderAttribution orderPlatform(). */
export const PLATFORM_EXPR = sql<string>`case
  when orders.client_source in ('android_app', 'ios_app') then orders.client_source
  when orders.client_source = 'web' and orders.client_device_type in ('mobile', 'desktop', 'tablet')
    then orders.client_device_type || '_web'
  else 'unknown' end`;

function paymentModeCondition(group: string): RawBuilder<SqlBool> {
  if (group === "unknown") return sql<SqlBool>`orders.payment_mode is null`;
  if (group === "other") {
    return sql<SqlBool>`(orders.payment_mode is not null and orders.payment_mode not in (${sql.join(ALL_MODE_CODES)}))`;
  }
  const codes = PAYMENT_MODE_GROUP_CODES[group as keyof typeof PAYMENT_MODE_GROUP_CODES] ?? [];
  return sql<SqlBool>`orders.payment_mode in (${sql.join(codes)})`;
}

export const PAYMENT_MODE_GROUP_EXPR = sql<string>`case
  when orders.payment_mode is null then 'unknown'
  ${sql.join(
    Object.entries(PAYMENT_MODE_GROUP_CODES).map(
      ([group, codes]) => sql`when orders.payment_mode in (${sql.join(codes)}) then ${sql.lit(group)}`
    ),
    sql` `
  )}
  else 'other' end`;

const LIVE_TEST_TXN = sql<SqlBool>`coalesce(orders.payment_transaction_id, '') like 'live-test-%'`;

function hasItem(column: string): RawBuilder<SqlBool> {
  return sql<SqlBool>`exists (select 1 from order_items oi where oi.order_id = orders.id and ${sql.raw(`oi.${column}`)} is not null)`;
}

const PRODUCT_CONDITIONS: Record<string, RawBuilder<SqlBool>> = {
  live_test: LIVE_TEST_TXN,
  test: sql<SqlBool>`(${hasItem("mock_test_id")} and not ${LIVE_TEST_TXN} and orders.bundle_id is null)`,
  course: sql<SqlBool>`(${hasItem("course_id")} and orders.bundle_id is null)`,
  notes: sql<SqlBool>`(${hasItem("digital_product_id")} and orders.bundle_id is null)`,
  bundle: sql<SqlBool>`orders.bundle_id is not null`,
  mentorship: sql<SqlBool>`exists (select 1 from order_items oi where oi.order_id = orders.id
    and (oi.mentorship_plan_id is not null or oi.mentorship_session_type_id is not null or oi.mentorship_booking_id is not null))`,
};

/** The teacher an order is credited to: its first item's teacher, else the bundle's. */
export const TEACHER_ID_EXPR = sql<number | null>`coalesce(
  (select coalesce(mt.teacher_id, c.teacher_id, dp.teacher_id)
     from order_items oi
     left join mock_tests mt on mt.id = oi.mock_test_id
     left join courses c on c.id = oi.course_id
     left join digital_products dp on dp.id = oi.digital_product_id
    where oi.order_id = orders.id and coalesce(mt.teacher_id, c.teacher_id, dp.teacher_id) is not null
    order by oi.id limit 1),
  (select cb.teacher_id from course_bundles cb where cb.id = orders.bundle_id))`;

export function orderWhere(f: AdminOrderFilters): RawBuilder<SqlBool> {
  const conditions: RawBuilder<SqlBool>[] = [];

  const search = f.search?.trim();
  if (search) {
    const like = `%${escapeLike(search)}%`;
    const idMatch = search.match(/^#?(\d{1,9})$/);
    const people = (alias: string) =>
      sql`(${sql.raw(alias)}.display_name ilike ${like} or ${sql.raw(alias)}.email ilike ${like} or ${sql.raw(alias)}.mobile_number ilike ${like})`;
    const parts: RawBuilder<SqlBool>[] = [
      sql<SqlBool>`orders.payment_transaction_id ilike ${like}`,
      sql<SqlBool>`orders.client_ip ilike ${like}`,
      sql<SqlBool>`exists (select 1 from users u where u.id = orders.user_id and ${people("u")})`,
      sql<SqlBool>`exists (select 1 from teacher_sponsored_enrollments tse join users su on su.id = tse.student_id
        where tse.order_id = orders.id and ${people("su")})`,
      sql<SqlBool>`exists (select 1 from promo_codes pc where pc.id = orders.promo_code_id and pc.code ilike ${like})`,
    ];
    if (idMatch) parts.push(sql<SqlBool>`orders.id = ${Number(idMatch[1])}`);
    conditions.push(anyOf(parts));
  }

  if (f.statuses?.length) conditions.push(sql<SqlBool>`orders.status::text in (${sql.join(f.statuses)})`);
  if (f.stalePending) {
    conditions.push(sql<SqlBool>`(orders.status = 'pending' and orders.created_at < now() - interval '1 hour')`);
  }

  if (f.createdFrom) conditions.push(sql<SqlBool>`orders.created_at >= ${f.createdFrom}`);
  if (f.createdTo) conditions.push(sql<SqlBool>`orders.created_at < ${f.createdTo}`);
  if (f.paidFrom) conditions.push(sql<SqlBool>`orders.paid_at >= ${f.paidFrom}`);
  if (f.paidTo) conditions.push(sql<SqlBool>`orders.paid_at < ${f.paidTo}`);

  if (f.platforms?.length) conditions.push(anyOf(f.platforms.map((p) => PLATFORM_CONDITIONS[p])));
  if (f.osNames?.length) conditions.push(facetCondition("client_os_name", f.osNames));
  if (f.browsers?.length) conditions.push(facetCondition("client_browser_name", f.browsers));
  if (f.brands?.length) conditions.push(facetCondition("client_device_brand", f.brands));
  if (f.deviceTypes?.length) {
    conditions.push(sql<SqlBool>`coalesce(orders.client_device_type, 'unknown') in (${sql.join(f.deviceTypes)})`);
  }

  if (f.paymentMethods?.length) conditions.push(facetCondition("payment_method", f.paymentMethods));
  if (f.paymentModes?.length) conditions.push(anyOf(f.paymentModes.map(paymentModeCondition)));
  if (f.gateways?.length) {
    conditions.push(
      anyOf(
        f.gateways.map((g) =>
          g === "payu" ? sql<SqlBool>`orders.payment_method = 'payu'` : sql<SqlBool>`orders.payment_method is distinct from 'payu'`
        )
      )
    );
  }

  if (f.productTypes?.length) conditions.push(anyOf(f.productTypes.map((t) => PRODUCT_CONDITIONS[t])));

  if (f.teacherIds?.length) {
    const ids = sql.join(f.teacherIds);
    conditions.push(
      anyOf([
        sql<SqlBool>`exists (select 1 from order_items oi
          left join mock_tests mt on mt.id = oi.mock_test_id
          left join courses c on c.id = oi.course_id
          left join digital_products dp on dp.id = oi.digital_product_id
          where oi.order_id = orders.id and coalesce(mt.teacher_id, c.teacher_id, dp.teacher_id) in (${ids}))`,
        sql<SqlBool>`exists (select 1 from course_bundles cb where cb.id = orders.bundle_id and cb.teacher_id in (${ids}))`,
      ])
    );
  }

  if (f.promoCodes?.length) {
    const codes = f.promoCodes.map((code) => code.toLowerCase());
    conditions.push(
      sql<SqlBool>`(lower(orders.promo_code_snapshot) in (${sql.join(codes)}) or exists (select 1 from promo_codes pc where pc.id = orders.promo_code_id and lower(pc.code) in (${sql.join(codes)})))`
    );
  }

  // Same rule as orderDiscountBreakdown: a promo code wins, then Tcoins, else none.
  if (f.discount === "promo_code") conditions.push(sql<SqlBool>`orders.promo_code_id is not null`);
  if (f.discount === "tcoins") conditions.push(sql<SqlBool>`(orders.promo_code_id is null and orders.tcoins_redeemed > 0)`);
  if (f.discount === "none") conditions.push(sql<SqlBool>`(orders.promo_code_id is null and orders.tcoins_redeemed = 0)`);
  if (f.amountMin !== undefined) conditions.push(sql<SqlBool>`orders.total_amount >= ${f.amountMin}`);
  if (f.amountMax !== undefined) conditions.push(sql<SqlBool>`orders.total_amount <= ${f.amountMax}`);

  if (conditions.length === 0) return sql<SqlBool>`true`;
  return sql<SqlBool>`(${sql.join(conditions, sql` and `)})`;
}

export function orderSortSql(sort: AdminOrderSort): RawBuilder<unknown> {
  const dir = sql.raw(sort.direction === "asc" ? "asc" : "desc");
  switch (sort.column) {
    case "id":
      return sql`orders.id ${dir}`;
    case "paidAt":
      return sql`orders.paid_at ${dir} nulls last, orders.id ${dir}`;
    case "student":
      return sql`users.display_name ${dir}, orders.id desc`;
    case "amount":
      return sql`orders.total_amount ${dir}, orders.id desc`;
    case "status":
      return sql`orders.status::text ${dir}, orders.id desc`;
    case "date":
    default:
      return sql`orders.created_at ${dir} nulls last, orders.id ${dir}`;
  }
}

/** Order ids matching the filters, in display order. limit undefined returns all of them. */
export async function findOrderIds(
  filters: AdminOrderFilters,
  sort: AdminOrderSort,
  limit?: number,
  offset = 0
): Promise<number[]> {
  let query = db
    .selectFrom("orders")
    .innerJoin("users", "users.id", "orders.userId")
    .select("orders.id")
    .where(orderWhere(filters))
    .orderBy(orderSortSql(sort));
  if (limit !== undefined) query = query.limit(limit).offset(offset);
  const rows = await query.execute();
  return rows.map((row) => row.id);
}

export async function countOrders(filters: AdminOrderFilters): Promise<number> {
  const row = await db
    .selectFrom("orders")
    .select(sql<string>`count(*)`.as("count"))
    .where(orderWhere(filters))
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

/** Orders that Reconcile all pending would touch: pending ones, and unpaid ones with no PayU reason yet. */
export async function countReconcilable(): Promise<number> {
  const row = await db
    .selectFrom("orders")
    .select(sql<string>`count(*)`.as("count"))
    .where(
      sql<SqlBool>`orders.payment_transaction_id is not null and (orders.status = 'pending'
        or (orders.status in ('failed', 'cancelled') and orders.payment_error_code is null
          and orders.payment_error_message is null and orders.payment_bank_message is null
          and orders.payment_gateway_status is null))`
    )
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const CHUNK = 1000;

/** Full rows for the given order ids, returned in the same order. */
export async function loadOrderRows(ids: number[]): Promise<AdminOrderRow[]> {
  if (ids.length === 0) return [];
  if (ids.length > CHUNK) {
    const parts: AdminOrderRow[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) parts.push(...(await loadOrderRows(ids.slice(i, i + CHUNK))));
    return parts;
  }

  const [orders, items, sponsored] = await Promise.all([
    db
      .selectFrom("orders")
      .innerJoin("users", "users.id", "orders.userId")
      .leftJoin("promoCodes", "promoCodes.id", "orders.promoCodeId")
      .leftJoin("courseBundles", "courseBundles.id", "orders.bundleId")
      .select([
        "orders.id",
        "orders.userId",
        "orders.bundleId",
        "orders.createdAt",
        "orders.paidAt",
        "orders.totalAmount",
        "orders.discountAmount",
        "orders.tcoinsRedeemed",
        "orders.status",
        "orders.paymentMethod",
        "orders.paymentMode",
        "orders.paymentTransactionId",
        "orders.invoiceNumber",
        "orders.paymentErrorCode",
        "orders.paymentErrorMessage",
        "orders.paymentBankMessage",
        "orders.paymentGatewayStatus",
        "orders.promoCodeId",
        "orders.promoCodeSnapshot",
        "orders.promoAutoApplied",
        "orders.refundedAt",
        "orders.refundReason",
        "orders.clientSource",
        "orders.clientDeviceType",
        "orders.clientOsName",
        "orders.clientOsVersion",
        "orders.clientBrowserName",
        "orders.clientBrowserVersion",
        "orders.clientDeviceBrand",
        "orders.clientDeviceModel",
        "orders.clientAppVersion",
        "orders.clientScreen",
        "orders.clientReferrer",
        "orders.clientUserAgent",
        "orders.clientIp",
        "promoCodes.code as promoCode",
        "courseBundles.title as bundleTitle",
        "courseBundles.slug as bundleSlug",
        "courseBundles.teacherId as bundleTeacherId",
        "users.displayName as studentName",
        "users.email as studentEmail",
        "users.mobileNumber as studentPhone",
      ])
      .where("orders.id", "in", ids)
      .execute(),
    db
      .selectFrom("orderItems")
      .leftJoin("mockTests", "mockTests.id", "orderItems.mockTestId")
      .leftJoin("courses", "courses.id", "orderItems.courseId")
      .leftJoin("digitalProducts", "digitalProducts.id", "orderItems.digitalProductId")
      .select([
        "orderItems.id",
        "orderItems.orderId",
        "mockTests.title as testTitle",
        "mockTests.slug as testSlug",
        "mockTests.teacherId as testTeacherId",
        "courses.title as courseTitle",
        "courses.slug as courseSlug",
        "courses.teacherId as courseTeacherId",
        "digitalProducts.title as productTitle",
        "digitalProducts.slug as productSlug",
        "digitalProducts.teacherId as productTeacherId",
      ])
      .where("orderItems.orderId", "in", ids)
      .orderBy("orderItems.id")
      .execute(),
    db
      .selectFrom("teacherSponsoredEnrollments")
      .leftJoin("users", "users.id", "teacherSponsoredEnrollments.studentId")
      .select([
        "teacherSponsoredEnrollments.orderId",
        "users.displayName as studentName",
        "users.email as studentEmail",
        "users.mobileNumber as studentPhone",
        "users.id as studentId",
      ])
      .where("teacherSponsoredEnrollments.orderId", "in", ids)
      .execute(),
  ]);

  // Live test orders carry the underlying mock test as their item; the product is the live test.
  const liveTestByOrder = new Map<number, number>();
  for (const order of orders) {
    const match = order.paymentTransactionId?.match(/^live-test-(\d+)-/);
    if (match) liveTestByOrder.set(order.id, Number(match[1]));
  }
  const liveTestIds = [...new Set(liveTestByOrder.values())];
  const liveTests = liveTestIds.length
    ? await db
        .selectFrom("liveTests")
        .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
        .select(["liveTests.id", "liveTests.title", "mockTests.slug", "mockTests.teacherId"])
        .where("liveTests.id", "in", liveTestIds)
        .execute()
    : [];
  const liveTestById = new Map(liveTests.map((lt) => [lt.id, lt]));

  const details = new Map<number, PurchasedItemDetail[]>();
  const teacherByOrder = new Map<number, number>();
  const push = (orderId: number, detail: PurchasedItemDetail, teacherId: number | null) => {
    const list = details.get(orderId) ?? [];
    list.push(detail);
    details.set(orderId, list);
    if (teacherId && !teacherByOrder.has(orderId)) teacherByOrder.set(orderId, teacherId);
  };

  for (const [orderId, liveTestId] of liveTestByOrder) {
    const liveTest = liveTestById.get(liveTestId);
    if (liveTest) push(orderId, { title: liveTest.title, type: "live_test", url: `/live-test/${liveTest.slug}` }, liveTest.teacherId);
  }
  for (const item of items) {
    if (item.testTitle && !liveTestByOrder.has(item.orderId)) {
      push(item.orderId, { title: item.testTitle, type: "test", url: `/mock-test/${item.testSlug}` }, item.testTeacherId);
    }
    if (item.courseTitle) {
      push(item.orderId, { title: item.courseTitle, type: "course", url: `/course/${item.courseSlug}` }, item.courseTeacherId);
    }
    if (item.productTitle) {
      push(item.orderId, { title: item.productTitle, type: "product", url: `/study-notes/${item.productSlug}` }, item.productTeacherId);
    }
    const teacherId = item.testTeacherId ?? item.courseTeacherId ?? item.productTeacherId;
    if (teacherId && !teacherByOrder.has(item.orderId)) teacherByOrder.set(item.orderId, teacherId);
  }
  for (const order of orders) {
    if (order.bundleTeacherId && !teacherByOrder.has(order.id)) teacherByOrder.set(order.id, order.bundleTeacherId);
  }

  const teacherIds = [...new Set(teacherByOrder.values())];
  const teachers = teacherIds.length
    ? await db.selectFrom("users").select(["id", "displayName"]).where("id", "in", teacherIds).execute()
    : [];
  const teacherName = new Map(teachers.map((t) => [t.id, t.displayName]));
  const sponsoredByOrder = new Map(sponsored.filter((s) => s.orderId !== null).map((s) => [s.orderId as number, s]));

  const byId = new Map<number, AdminOrderRow>();
  for (const o of orders) {
    let purchasedItemDetails = details.get(o.id) ?? [];
    if (purchasedItemDetails.length === 0 && o.bundleTitle && o.bundleSlug) {
      purchasedItemDetails = [{ title: o.bundleTitle, type: "bundle", url: `/bundles/${o.bundleSlug}` }];
    }
    const purchasedItems =
      purchasedItemDetails.map((d) => d.title).join(", ") || (o.bundleTitle ? `Bundle: ${o.bundleTitle}` : null);
    const sponsor = sponsoredByOrder.get(o.id);
    const teacherId = teacherByOrder.get(o.id) ?? null;
    const source = (o.clientSource ?? null) as OrderClientSource | null;
    const deviceType = (o.clientDeviceType ?? "unknown") as OrderClientDeviceType;
    const breakdown = orderDiscountBreakdown({
      totalAmount: num(o.totalAmount),
      discountAmount: num(o.discountAmount),
      tcoinsRedeemed: o.tcoinsRedeemed ?? 0,
      promoCodeId: o.promoCodeId,
    });

    byId.set(o.id, {
      id: o.id,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      studentId: sponsor?.studentId ?? o.userId,
      studentName: sponsor ? sponsor.studentName ?? "Deleted account" : o.studentName,
      studentEmail: sponsor ? sponsor.studentEmail : o.studentEmail,
      studentPhone: sponsor ? sponsor.studentPhone : o.studentPhone || null,
      isSponsored: !!sponsor,
      teacherId,
      teacherName: teacherId ? teacherName.get(teacherId) ?? null : null,
      purchasedItems,
      purchasedItemDetails,
      totalAmount: num(o.totalAmount),
      discountAmount: num(o.discountAmount),
      tcoinsRedeemed: o.tcoinsRedeemed ?? 0,
      discountMethod: breakdown.method,
      originalAmount: breakdown.originalAmount,
      tcoinsValue: breakdown.tcoinsValue,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentMode: o.paymentMode,
      paymentTransactionId: o.paymentTransactionId,
      invoiceNumber: o.invoiceNumber,
      promoCodeId: o.promoCodeId,
      promoCode: o.promoCodeSnapshot ?? o.promoCode,
      promoAutoApplied: o.promoAutoApplied,
      refundedAt: o.refundedAt,
      refundReason: o.refundReason,
      paymentFailure:
        o.status === "failed" || o.status === "cancelled"
          ? paymentFailureReason.details({
              paymentErrorCode: o.paymentErrorCode,
              paymentErrorMessage: o.paymentErrorMessage,
              paymentBankMessage: o.paymentBankMessage,
              paymentGatewayStatus: o.paymentGatewayStatus,
            })
          : null,
      client: source
        ? {
            source,
            platform: orderPlatform(source, deviceType),
            deviceType,
            osName: o.clientOsName,
            osVersion: o.clientOsVersion,
            browserName: o.clientBrowserName,
            browserVersion: o.clientBrowserVersion,
            deviceBrand: o.clientDeviceBrand,
            deviceModel: o.clientDeviceModel,
            appVersion: o.clientAppVersion,
            screen: o.clientScreen,
            referrer: o.clientReferrer,
            userAgent: o.clientUserAgent,
            ip: o.clientIp,
          }
        : null,
    });
  }

  return ids.map((id) => byId.get(id)).filter((row): row is AdminOrderRow => !!row);
}
