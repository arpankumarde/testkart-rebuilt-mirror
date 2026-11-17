import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, InputType, OutputType } from "./purchase_POST.schema";
import { isTeacherSlotBookable } from "../../helpers/mentorshipSlots";
import { CHECKOUT_HOLD_MINUTES } from "../../helpers/liveLessonConfig";
import { isLiveClassMinutes, pricesMeetFloors, resolveLivePrices, trialPriceFor } from "../../helpers/livePricing";
import { getLiveBalance, getLivePackageFor, getTrialState, isStudentFree, roundMoney, studentBalanceLock } from "../../helpers/livePackages";
import { ensureOrderCompletionSideEffects } from "../../helpers/ensureOrderCompletionSideEffects";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../helpers/getTeacherPlatformFee";
import { getOrderClientInfo } from "../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";
import { openCashfreeSession, settleCashfreeOrder } from "../../helpers/cashfreeOrders";
import { cashfreeGatewayEnv, terminateCashfreeOrder } from "../../helpers/cashfree";
import { liveBookingPath } from "../../helpers/liveBookingRoutes";
import { liveBookingContactProblem } from "../../helpers/liveBookingContact";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      throw new NotAuthenticatedError("Only students can book 1:1 sessions.");
    }
    const contactProblem = await liveBookingContactProblem(user.id);
    if (contactProblem) throw new Error(contactProblem);

    const json = superjson.parse<InputType>(await request.text());
    const { teacherId, durationMinutes, startTime } = schema.parse(json);

    if (!isLiveClassMinutes(durationMinutes)) {
      throw new Error("Unsupported session duration.");
    }

    const teacher = await db
      .selectFrom("teachers")
      .select([
        "id",
        "slug",
        "mentorshipEnabled",
        "mentorshipRatePerUnit",
        "mentorshipClassPrice60",
        "mentorshipTrialDiscount",
        "liveTeachingStatus",
      ])
      .where("id", "=", teacherId)
      .executeTakeFirst();

    const prices = teacher ? resolveLivePrices(teacher) : null;
    if (
      !teacher ||
      !teacher.mentorshipEnabled ||
      teacher.liveTeachingStatus !== "approved" ||
      !prices ||
      !pricesMeetFloors(prices)
    ) {
      throw new Error("This teacher does not currently offer 1:1 sessions.");
    }

    // A newer checkout replaces an older unpaid one, so a stale order cannot later book a different
    // slot. Each is terminated at Cashfree first; one Cashfree will not terminate (it may be paid)
    // is settled and otherwise left pending, never cancelled while it can still take money.
    const older = await db
      .selectFrom("orders")
      .select(["id", "paymentTransactionId"])
      .where("userId", "=", user.id)
      .where("status", "=", "pending")
      .where("paymentMethod", "=", "cashfree")
      .where("paymentTransactionId", "like", `mentorship-${teacherId}-%`)
      .execute();
    const terminated: number[] = [];
    for (const o of older) {
      if (o.paymentTransactionId && (await terminateCashfreeOrder(o.paymentTransactionId))) {
        terminated.push(o.id);
      } else {
        await settleCashfreeOrder(o.id).catch((error) => console.error(`[mentorship/purchase] Could not settle order ${o.id}:`, error));
      }
    }

    const [trialState, livePackage] = await Promise.all([getTrialState(user.id, teacherId), getLivePackageFor(user.id, teacherId)]);
    if (livePackage) throw new Error("You already have a package with this teacher. Book from your classes page.");
    if (trialState === "booked") throw new Error("Your trial with this teacher is already booked.");
    if (trialState === "done") throw new Error("You have had your trial with this teacher. Choose a package to keep going.");

    const bookable = await isTeacherSlotBookable(teacherId, startTime, durationMinutes);
    if (!bookable.ok) throw new Error(bookable.reason);
    if (!(await isStudentFree(db, user.id, startTime, durationMinutes))) {
      throw new Error("You already have a class at this time.");
    }

    const price = roundMoney(trialPriceFor(prices, durationMinutes));
    const cashfreeOrderId = `mentorship-${teacherId}-${durationMinutes}-${nanoid(12)}`;
    const platformFeePercentage = await getTeacherPlatformFee(teacherId).catch(() => DEFAULT_TEACHER_PLATFORM_FEE);

    const created = await db.transaction().execute(async (trx) => {
      if (terminated.length > 0) {
        await trx
          .updateTable("orders")
          .set({ status: "cancelled", updatedAt: new Date() })
          .where("id", "in", terminated)
          .where("status", "=", "pending")
          .execute();
      }

      await studentBalanceLock(user.id).execute(trx);
      const balance = await getLiveBalance(user.id, trx);
      const balanceUsed = roundMoney(Math.max(0, Math.min(balance, price)));
      const toPay = roundMoney(price - balanceUsed);
      const coveredHere = toPay <= 0;

      const newOrder = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          ...getOrderClientInfo(request),
          ...getOrderAttribution(request),
          totalAmount: toPay.toFixed(2),
          status: coveredHere ? "completed" : "pending",
          paymentMethod: coveredHere ? "live_balance" : "cashfree",
          paymentTransactionId: cashfreeOrderId,
          liveBalanceUsed: balanceUsed.toFixed(2),
          liveHoldUntil: new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60000),
          ...(coveredHere ? { paidAt: new Date() } : { gatewayEnv: cashfreeGatewayEnv() }),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("orderItems")
        .values({
          orderId: newOrder.id,
          // Recorded so ensureOrderCompletionSideEffects creates the booking and its trial credit
          // once the payment is confirmed, whether that is the return from checkout or the webhook.
          mentorshipTeacherId: teacherId,
          mentorshipDurationMinutes: durationMinutes,
          mentorshipRequestedStartTime: startTime,
          priceAtPurchase: price.toFixed(2),
          platformFeePercentage: platformFeePercentage.toFixed(2),
        })
        .execute();

      return { orderId: newOrder.id, toPay, coveredHere };
    });
    const { orderId, toPay, coveredHere } = created;

    if (coveredHere) {
      await ensureOrderCompletionSideEffects(orderId);
      return new Response(superjson.stringify({ kind: "completed", orderId } satisfies OutputType));
    }

    const session = await openCashfreeSession({
      orderId,
      cashfreeOrderId,
      amount: toPay,
      user,
      returnPath: liveBookingPath(teacher),
      note: `Trial class (${durationMinutes} min)`,
    });

    await recordFunnelEvent({
      event: "checkout_started",
      request,
      userId: user.id,
      orderId,
      entityType: "mentorship_booking",
      entityId: teacherId,
      amount: toPay.toFixed(2),
      props: { path: "mentorship", gateway: "cashfree", trial: true },
    });

    return new Response(superjson.stringify({ kind: "checkout", session } satisfies OutputType));
  } catch (error) {
    console.error("Failed to initiate trial booking:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Could not book the trial.", details: errorMessage }), { status: 400 });
  }
}
