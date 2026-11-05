import { createHash, randomBytes } from "crypto";
import type { Kysely, Selectable, Transaction } from "kysely";
import { db } from "./db";
import type { DB, PayRequests } from "./schema";
import { courseEffectivePriceSql } from "./coursePricing";
import { productEffectivePriceSql } from "./digitalProductPricing";

/**
 * "Ask someone to pay": a student shares a link, anyone opens it on
 * testkart.in and pays by PayU, and the student gets the items. The payer is
 * never signed in: PayU's callback sees udf2 = PAY_LINK_UDF and skips the
 * session cookie it sets for normal checkouts. Prices are worked out again
 * when the link is opened and when it is paid; items the student already owns
 * are left out.
 */

type Executor = Kysely<DB> | Transaction<DB>;

export const PAY_LINK_UDF = "paylink";
export const PAY_LINK_TTL_HOURS = 72;
export const PAY_LINK_MAX_AMOUNT = 10000;
export const PAY_LINK_DAILY_LIMIT = 10;

export type PayLinkItem = { kind: "test" | "course" | "digitalProduct"; id: number };

export const newPayLinkToken = () => randomBytes(24).toString("base64url");
export const hashPayLinkToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const payLinkUrl = (token: string) => `https://testkart.in/pay/${token}`;

export function parsePayLinkItems(value: unknown): PayLinkItem[] {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): PayLinkItem[] => {
    if (!entry || typeof entry !== "object") return [];
    const { kind, id } = entry as { kind?: unknown; id?: unknown };
    if ((kind === "test" || kind === "course" || kind === "digitalProduct") && Number.isInteger(id) && (id as number) > 0) {
      return [{ kind, id: id as number }];
    }
    return [];
  });
}

/** The cart row shape the checkout pricing helpers take, plus a title. */
export type PayableRow = {
  mockTestId: number | null;
  courseId: number | null;
  digitalProductId: number | null;
  title: string;
  testPrice: string | null;
  testDiscountPrice: string | null;
  testTeacherId: number | null;
  coursePrice: string | null;
  courseTeacherId: number | null;
  digitalProductPrice: string | null;
  digitalProductTeacherId: number | null;
};

const emptyRow = {
  mockTestId: null,
  courseId: null,
  digitalProductId: null,
  testPrice: null,
  testDiscountPrice: null,
  testTeacherId: null,
  coursePrice: null,
  courseTeacherId: null,
  digitalProductPrice: null,
  digitalProductTeacherId: null,
};

const idsOf = (items: PayLinkItem[], kind: PayLinkItem["kind"]) => [...new Set(items.filter((i) => i.kind === kind).map((i) => i.id))];

/** The items at today's prices, without the ones the student already owns. */
export async function loadPayableRows(executor: Executor, userId: number, items: PayLinkItem[]): Promise<PayableRow[]> {
  const testIds = idsOf(items, "test");
  const courseIds = idsOf(items, "course");
  const productIds = idsOf(items, "digitalProduct");

  const tests = testIds.length
    ? await executor
        .selectFrom("mockTests")
        .select(["mockTests.id", "mockTests.title", "mockTests.price", "mockTests.discountPrice", "mockTests.teacherId"])
        .where("mockTests.id", "in", testIds)
        .where(({ not, exists, selectFrom }) =>
          not(exists(selectFrom("mockTestEnrollments").select("mockTestEnrollments.id").whereRef("mockTestEnrollments.mockTestId", "=", "mockTests.id").where("mockTestEnrollments.studentId", "=", userId)))
        )
        .execute()
    : [];
  const courses = courseIds.length
    ? await executor
        .selectFrom("courses")
        .select(["courses.id", "courses.title", "courses.teacherId", courseEffectivePriceSql.as("coursePrice")])
        .where("courses.id", "in", courseIds)
        .where(({ not, exists, selectFrom }) =>
          not(exists(selectFrom("courseEnrollments").select("courseEnrollments.id").whereRef("courseEnrollments.courseId", "=", "courses.id").where("courseEnrollments.studentId", "=", userId)))
        )
        .execute()
    : [];
  const products = productIds.length
    ? await executor
        .selectFrom("digitalProducts")
        .select(["digitalProducts.id", "digitalProducts.title", "digitalProducts.teacherId", productEffectivePriceSql.as("digitalProductPrice")])
        .where("digitalProducts.id", "in", productIds)
        .where(({ not, exists, selectFrom }) =>
          not(exists(selectFrom("digitalProductPurchases").select("digitalProductPurchases.id").whereRef("digitalProductPurchases.productId", "=", "digitalProducts.id").where("digitalProductPurchases.studentId", "=", userId)))
        )
        .execute()
    : [];

  const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return [
    ...tests.map((t): PayableRow => ({ ...emptyRow, mockTestId: t.id, title: t.title, testPrice: str(t.price), testDiscountPrice: str(t.discountPrice), testTeacherId: t.teacherId })),
    ...courses.map((c): PayableRow => ({ ...emptyRow, courseId: c.id, title: c.title, coursePrice: str(c.coursePrice), courseTeacherId: c.teacherId })),
    ...products.map((p): PayableRow => ({ ...emptyRow, digitalProductId: p.id, title: p.title, digitalProductPrice: str(p.digitalProductPrice), digitalProductTeacherId: p.teacherId })),
  ];
}

export function payableRowPrice(row: PayableRow): number {
  const value = row.mockTestId ? row.testDiscountPrice ?? row.testPrice : row.courseId ? row.coursePrice : row.digitalProductPrice;
  return Number(value ?? 0) || 0;
}

export const payableRowKind = (row: PayableRow): PayLinkItem["kind"] => (row.mockTestId ? "test" : row.courseId ? "course" : "digitalProduct");

export async function findPayRequest(executor: Executor, token: string): Promise<Selectable<PayRequests> | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = await executor.selectFrom("payRequests").selectAll().where("tokenHash", "=", hashPayLinkToken(token)).executeTakeFirst();
  return row ?? null;
}

export async function findPaidOrder(executor: Executor, payRequestId: number) {
  return (
    (await executor
      .selectFrom("orders")
      .select(["id", "totalAmount", "updatedAt"])
      .where("payRequestId", "=", payRequestId)
      .where("status", "=", "completed")
      .executeTakeFirst()) ?? null
  );
}

export function studentFirstName(displayName: string | null | undefined): string {
  const first = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 0 ? first.slice(0, 40) : "A student";
}

export function maskPhone(mobile: string | null | undefined): string | null {
  const digits = (mobile ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `******${digits.slice(-4)}` : null;
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function payLinkMessageHtml(title: string, message: string, backUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fbf6f2; color: #2b1a10; text-align: center; }
    .box { max-width: 420px; padding: 2rem; background: #ffffff; border: 1px solid #e6d5c8; border-radius: 12px; }
    h1 { font-size: 1.35rem; margin: 0 0 0.75rem; }
    p { margin: 0 0 1.5rem; line-height: 1.5; color: #4a3424; }
    a { display: inline-block; padding: 0.75rem 1.5rem; background: #903209; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="${escapeHtml(backUrl)}">Go back</a>
  </div>
</body>
</html>`;
}

export function payuAutoPostHtml(payuUrl: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join("\n    ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Opening PayU...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fbf6f2; color: #2b1a10; text-align: center; }
  </style>
</head>
<body>
  <p>Opening PayU, our secure payment page. Please do not refresh or press back.</p>
  <form id="payuForm" method="POST" action="${escapeHtml(payuUrl)}">
    ${inputs}
  </form>
  <script>document.getElementById("payuForm").submit();</script>
</body>
</html>`;
}

/** Links a student made in the last 24 hours, for the daily limit. */
export async function countRecentPayLinks(userId: number): Promise<number> {
  const row = await db
    .selectFrom("payRequests")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("userId", "=", userId)
    .where("createdAt", ">", new Date(Date.now() - 24 * 3600 * 1000))
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}
