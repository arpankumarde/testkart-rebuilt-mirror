import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { previewCartCoupons, checkoutLines } from "../../helpers/cartCouponStackServer";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";
import {
  findPaidOrder,
  findPayRequest,
  loadPayableRows,
  maskPhone,
  parsePayLinkItems,
  payableRowKind,
  payableRowPrice,
  studentFirstName,
} from "../../helpers/payLinkServer";
import { schema, OutputType } from "./info_GET.schema";

/** Public: what a payment link is for. Shows only the student's first name and the last 4 digits of their phone. */
export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { token } = schema.parse({ token: url.searchParams.get("token") ?? "" });
    const payRequest = await findPayRequest(db, token);
    if (!payRequest) {
      return new Response(superjson.stringify({ error: "This payment link is not valid. Ask for a new one." }), { status: 404 });
    }

    const student = await db.selectFrom("students").select(["displayName", "mobileNumber"]).where("id", "=", payRequest.userId).executeTakeFirst();
    const base = {
      studentName: studentFirstName(student?.displayName),
      maskedPhone: maskPhone(student?.mobileNumber),
      expiresAt: payRequest.expiresAt,
    };

    const paid = await findPaidOrder(db, payRequest.id);
    if (paid) {
      const out: OutputType = { ...base, status: "paid", items: [], listTotal: 0, discount: 0, amount: Number(paid.totalAmount) };
      return new Response(superjson.stringify(out));
    }
    if (payRequest.expiresAt.getTime() < Date.now()) {
      const out: OutputType = { ...base, status: "expired", items: [], listTotal: 0, discount: 0, amount: 0 };
      return new Response(superjson.stringify(out));
    }

    const rows = await loadPayableRows(db, payRequest.userId, parsePayLinkItems(payRequest.items));
    const listTotal = rows.reduce((sum, r) => sum + payableRowPrice(r), 0);
    const quote = rows.length ? await previewCartCoupons({ userId: payRequest.userId, lines: checkoutLines(rows), chosen: null }) : null;
    const discount = Math.round((quote?.discountAmount ?? 0) * 100) / 100;
    const amount = Math.round(Math.max(0, listTotal - discount) * 100) / 100;

    const isFirstOpen = payRequest.openCount === 0;
    await db
      .updateTable("payRequests")
      .set({ openCount: sql`open_count + 1`, lastOpenedAt: new Date(), firstOpenedAt: payRequest.firstOpenedAt ?? new Date() })
      .where("id", "=", payRequest.id)
      .execute();
    if (isFirstOpen) {
      await recordFunnelEvent({ event: "pay_link_opened", request, userId: payRequest.userId, entityType: "pay_request", entityId: payRequest.id, amount });
    }

    const out: OutputType = {
      ...base,
      status: rows.length === 0 || amount <= 0 ? "nothing_to_pay" : "open",
      items: rows.map((r) => ({ title: r.title, kind: payableRowKind(r), price: payableRowPrice(r) })),
      listTotal: Math.round(listTotal * 100) / 100,
      discount,
      amount,
    };
    return new Response(superjson.stringify(out));
  } catch (error) {
    console.error("[pay-link/info] failed:", error);
    return new Response(superjson.stringify({ error: "Could not load this payment link." }), { status: 400 });
  }
}
