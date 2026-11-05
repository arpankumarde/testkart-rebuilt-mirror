import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, InputType, OutputType } from "./purchase_POST.schema";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../../helpers/_publicConfigs";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../../helpers/getTeacherPlatformFee";
import { sanitizePayuText } from "../../../helpers/sanitizePayuText";
import { getOrderClientInfo } from "../../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../../helpers/recordFunnelEvent";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      throw new NotAuthenticatedError("Only students can enroll in group lessons.");
    }

    const json = superjson.parse<InputType>(await request.text());
    const { groupLessonId, deepLinkUrl } = schema.parse(json);

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;
    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("PayU merchant key or salt is not configured.");
      throw new Error("Payment gateway is not configured.");
    }

    let createdOrderId: number | null = null;
    const payuFormData = await db.transaction().execute(async (trx) => {
      const lesson = await trx.selectFrom("groupLessons").selectAll().where("id", "=", groupLessonId).executeTakeFirst();
      if (!lesson) throw new Error("Group lesson not found.");
      if (lesson.status !== "scheduled") throw new Error("This group lesson is no longer open.");
      if (lesson.startTime < new Date()) throw new Error("This group lesson has already started.");
      if (lesson.enrolledCount >= lesson.maxCapacity) throw new Error("This group lesson is full.");
      if (Number(lesson.pricePerLearner) <= 0) throw new Error("This group lesson is free. Use the enroll endpoint directly.");

      const existing = await trx
        .selectFrom("groupLessonEnrollments")
        .select("id")
        .where("groupLessonId", "=", groupLessonId)
        .where("studentId", "=", user.id)
        .where("status", "=", "enrolled")
        .executeTakeFirst();
      if (existing) throw new Error("You are already enrolled in this group lesson.");

      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .where("paymentTransactionId", "like", `group-lesson-${groupLessonId}-%`)
        .execute();

      const txnid = `group-lesson-${groupLessonId}-${nanoid(12)}`;
      const amount = Number(lesson.pricePerLearner).toFixed(2);
      const productInfo = lesson.title.substring(0, 100);

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

      const platformFeePercentage = await getTeacherPlatformFee(lesson.teacherId, trx);

      await trx
        .insertInto("orderItems")
        .values({
          orderId: newOrder.id,
          // Recorded so ensureOrderCompletionSideEffects can create the
          // enrollment as a safety net if the order completes through a path
          // other than the client's explicit post-payment enroll_POST call.
          groupLessonId: groupLessonId,
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
        entityType: "group_lesson",
        entityId: groupLessonId,
        amount: payuFormData.amount,
        props: { path: "group_lesson" },
      });
    }
    return new Response(superjson.stringify(payuFormData));
  } catch (error) {
    console.error("Failed to initiate group lesson purchase:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to initiate payment.", details: errorMessage }), { status: 400 });
  }
}
