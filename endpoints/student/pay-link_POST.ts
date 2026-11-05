import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { previewCartCoupons, checkoutLines } from "../../helpers/cartCouponStackServer";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";
import {
  PAY_LINK_DAILY_LIMIT,
  PAY_LINK_MAX_AMOUNT,
  PAY_LINK_TTL_HOURS,
  countRecentPayLinks,
  hashPayLinkToken,
  loadPayableRows,
  newPayLinkToken,
  payLinkUrl,
  payableRowKind,
  payableRowPrice,
  type PayLinkItem,
} from "../../helpers/payLinkServer";
import { schema, OutputType } from "./pay-link_POST.schema";

/** Makes a link for the student's current cart that someone else can pay. */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    schema.parse(superjson.parse(await request.text()));
    if (user.role !== "student") throw new Error("Only students can create a payment link.");

    if ((await countRecentPayLinks(user.id)) >= PAY_LINK_DAILY_LIMIT) {
      throw new Error("You have made too many payment links today. Please use one you already shared, or try again tomorrow.");
    }

    const cart = await db
      .selectFrom("cartItems")
      .select(["mockTestId", "courseId", "digitalProductId"])
      .where("userId", "=", user.id)
      .execute();
    const items: PayLinkItem[] = cart.flatMap((c): PayLinkItem[] =>
      c.mockTestId ? [{ kind: "test", id: c.mockTestId }] : c.courseId ? [{ kind: "course", id: c.courseId }] : c.digitalProductId ? [{ kind: "digitalProduct", id: c.digitalProductId }] : []
    );
    if (items.length === 0) throw new Error("Your cart is empty.");

    const rows = await loadPayableRows(db, user.id, items);
    if (rows.length === 0) throw new Error("You already own everything in your cart.");

    const listTotal = rows.reduce((sum, r) => sum + payableRowPrice(r), 0);
    const quote = await previewCartCoupons({ userId: user.id, lines: checkoutLines(rows), chosen: null });
    const amount = Math.round(Math.max(0, listTotal - quote.discountAmount) * 100) / 100;
    if (amount <= 0) throw new Error("This cart is free, so there is nothing to pay. Use Complete Order instead.");
    if (amount > PAY_LINK_MAX_AMOUNT) throw new Error(`A payment link can be for at most Rs ${PAY_LINK_MAX_AMOUNT}. Remove some items and try again.`);

    const token = newPayLinkToken();
    const expiresAt = new Date(Date.now() + PAY_LINK_TTL_HOURS * 3600 * 1000);
    const created = await db
      .insertInto("payRequests")
      .values({
        tokenHash: hashPayLinkToken(token),
        userId: user.id,
        items: JSON.stringify(rows.map((r) => ({ kind: payableRowKind(r), id: r.mockTestId ?? r.courseId ?? r.digitalProductId }))),
        quotedAmount: amount.toFixed(2),
        expiresAt,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await recordFunnelEvent({ event: "pay_link_created", request, userId: user.id, entityType: "pay_request", entityId: created.id, amount });

    const url = payLinkUrl(token);
    const rupees = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    const what = rows.length === 1 ? rows[0].title : `${rows.length} items`;
    const shareText = `Hi, can you please pay for my Testkart study material (${what}, Rs ${rupees})? You can pay safely on testkart.in with UPI or a card: ${url}`;

    return new Response(superjson.stringify({ url, expiresAt, amount, itemCount: rows.length, shareText } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the link";
    return new Response(superjson.stringify({ error: message }), { status: /authenticat/i.test(message) ? 401 : 400 });
  }
}
