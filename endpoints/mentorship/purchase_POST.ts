import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, InputType, OutputType } from "./purchase_POST.schema";
import { isTeacherSlotBookable } from "../../helpers/mentorshipSlots";
import { MENTORSHIP_SESSION_DURATIONS, MENTORSHIP_RATE_UNIT_MINUTES, MENTORSHIP_MIN_RATE_PER_UNIT } from "../../helpers/liveLessonConfig";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../helpers/_publicConfigs";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../helpers/getTeacherPlatformFee";
import { sanitizePayuText } from "../../helpers/sanitizePayuText";
import { getOrderClientInfo } from "../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      throw new NotAuthenticatedError("Only students can book 1:1 sessions.");
    }

    const json = superjson.parse<InputType>(await request.text());
    const { teacherId, durationMinutes, startTime, deepLinkUrl } = schema.parse(json);

    if (!(MENTORSHIP_SESSION_DURATIONS as readonly number[]).includes(durationMinutes)) {
      throw new Error("Unsupported session duration.");
    }

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;
    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("PayU merchant key or salt is not configured.");
      throw new Error("Payment gateway is not configured.");
    }

    const teacher = await db
      .selectFrom("users")
      .select(["id", "role", "mentorshipEnabled", "mentorshipRatePerUnit", "liveTeachingStatus"])
      .where("id", "=", teacherId)
      .executeTakeFirst();

    const rate = Number(teacher?.mentorshipRatePerUnit ?? 0);
    if (
      !teacher ||
      teacher.role !== "teacher" ||
      !teacher.mentorshipEnabled ||
      teacher.liveTeachingStatus !== "approved" ||
      rate < MENTORSHIP_MIN_RATE_PER_UNIT
    ) {
      throw new Error("This teacher does not currently offer 1:1 sessions.");
    }

    const amountNumber = Math.round((rate * durationMinutes) / MENTORSHIP_RATE_UNIT_MINUTES);
    if (amountNumber <= 0) {
      throw new Error("This teacher's 1:1 sessions are not priced correctly. Please try another teacher.");
    }

    const bookable = await isTeacherSlotBookable(teacherId, startTime, durationMinutes);
    if (!bookable.ok) {
      throw new Error(bookable.reason);
    }

    // A student's first (non-cancelled) booking with a given teacher is a trial, Preply-style.
    const priorBooking = await db
      .selectFrom("mentorshipBookings")
      .select("id")
      .where("teacherId", "=", teacherId)
      .where("studentId", "=", user.id)
      .where("status", "!=", "cancelled")
      .executeTakeFirst();
    const isTrial = !priorBooking;

    let createdOrderId: number | null = null;
    const payuFormData = await db.transaction().execute(async (trx) => {
      // Cancel any previous pending order for this exact teacher+duration by this student so stale
      // orders can't later be replayed against a now-different slot.
      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .where("paymentTransactionId", "like", `mentorship-${teacherId}-${durationMinutes}-%`)
        .execute();

      const txnid = `mentorship-${teacherId}-${durationMinutes}-${nanoid(12)}`;
      const amount = amountNumber.toFixed(2);
      const productInfo = `${isTrial ? "Trial" : "1:1"} session (${durationMinutes} min)`.substring(0, 100);

      const newOrder = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          ...getOrderClientInfo(request),
          ...getOrderAttribution(request),
          totalAmount: amount,
          status: "pending",
          paymentMethod: "payu",
          paymentTransactionId: txnid,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      createdOrderId = newOrder.id;

      const platformFeePercentage = await getTeacherPlatformFee(teacherId, trx).catch(() => DEFAULT_TEACHER_PLATFORM_FEE);

      await trx
        .insertInto("orderItems")
        .values({
          orderId: newOrder.id,
          // Recorded so ensureOrderCompletionSideEffects can create the
          // booking as a safety net if the order completes through a path
          // other than the client's explicit post-payment create_POST call
          // (e.g. the async PayU server callback) instead of leaving a paid
          // order with no booking.
          mentorshipTeacherId: teacherId,
          mentorshipDurationMinutes: durationMinutes,
          mentorshipRequestedStartTime: startTime,
          priceAtPurchase: amount,
          platformFeePercentage: (platformFeePercentage ?? DEFAULT_TEACHER_PLATFORM_FEE).toFixed(2),
        })
        .execute();

      const firstname = sanitizePayuText(user.displayName || "Student");
      const email = user.email ?? `${user.mobileNumber}@mail.testkart.in`;
      const sanitizedProductInfo = sanitizePayuText(productInfo);
      const udf1 = deepLinkUrl ?? "";

      const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${sanitizedProductInfo}|${firstname}|${email}|${udf1}||||||||||${PAYU_MERCHANT_SALT}`;
      const hash = createHash("sha512").update(hashString).digest("hex");

      const payuUrl = PAYU_MODE !== "production" ? "https://test.payu.in/_payment" : "https://secure.payu.in/_payment";

      const responsePayload: OutputType = {
        key: PAYU_MERCHANT_KEY,
        txnid,
        amount,
        productinfo: sanitizedProductInfo,
        firstname,
        email,
        phone: user.mobileNumber || "9999999999",
        surl: `https://testkart.in/_api/payment/payu/callback`,
        furl: `https://testkart.in/_api/payment/payu/callback`,
        hash,
        payuUrl,
        ...(udf1 ? { udf1 } : {}),
      };
      return responsePayload;
    });

    if (createdOrderId !== null) {
      await recordFunnelEvent({
        event: "checkout_started",
        request,
        userId: user.id,
        orderId: createdOrderId,
        entityType: "mentorship_booking",
        entityId: teacherId,
        amount: payuFormData.amount,
        props: { path: "mentorship" },
      });
    }
    return new Response(superjson.stringify(payuFormData));
  } catch (error) {
    console.error("Failed to initiate mentorship booking purchase:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to initiate payment.", details: errorMessage }), { status: 400 });
  }
}
