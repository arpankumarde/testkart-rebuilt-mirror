import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, InputType, OutputType } from "./purchase_POST.schema";
import { isTeacherSlotBookable } from "../../helpers/mentorshipSlots";
import { CHECKOUT_HOLD_MINUTES } from "../../helpers/liveLessonConfig";
import { isLiveClassMinutes, pricesMeetFloors, resolveLivePrices, trialPriceFor } from "../../helpers/livePricing";
import { getLiveBalance, getLivePackageFor, getTrialState, isStudentFree, roundMoney } from "../../helpers/livePackages";
import { ensureOrderCompletionSideEffects } from "../../helpers/ensureOrderCompletionSideEffects";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../helpers/getTeacherPlatformFee";
import { getOrderClientInfo } from "../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";
import { openCashfreeSession } from "../../helpers/cashfreeOrders";
import { getCashfreeConfig } from "../../helpers/cashfree";
import { liveBookingPath } from "../../helpers/liveBookingRoutes";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      throw new NotAuthenticatedError("Only students can book 1:1 sessions.");
    }

    const json = superjson.parse<InputType>(await request.text());
    const { teacherId, durationMinutes, startTime } = schema.parse(json);

    if (!isLiveClassMinutes(durationMinutes)) {
      throw new Error("Unsupported session duration.");
    }

    const teacher = await db
      .selectFrom("users")
      .select([
        "id",
        "slug",
        "role",
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
      teacher.role !== "teacher" ||
      !teacher.mentorshipEnabled ||
      teacher.liveTeachingStatus !== "approved" ||
      !prices ||
      !pricesMeetFloors(prices)
    ) {
      throw new Error("This teacher does not currently offer 1:1 sessions.");
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
    const balance = await getLiveBalance(user.id);
    const balanceUsed = roundMoney(Math.max(0, Math.min(balance, price)));
    const toPay = roundMoney(price - balanceUsed);
    const coveredHere = toPay <= 0;

    if (!coveredHere) getCashfreeConfig();

    const cashfreeOrderId = `mentorship-${teacherId}-${durationMinutes}-${nanoid(12)}`;
    const platformFeePercentage = await getTeacherPlatformFee(teacherId).catch(() => DEFAULT_TEACHER_PLATFORM_FEE);

    const orderId = await db.transaction().execute(async (trx) => {
      // A newer checkout replaces an older unpaid one, so a stale order cannot later book a different slot.
      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .where("paymentTransactionId", "like", `mentorship-${teacherId}-%`)
        .execute();

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
          ...(coveredHere ? { paidAt: new Date() } : {}),
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

      return newOrder.id;
    });

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
