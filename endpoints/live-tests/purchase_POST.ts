import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, InputType, OutputType } from "./purchase_POST.schema";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../helpers/_publicConfigs";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { getTeacherPlatformFee } from "../../helpers/getTeacherPlatformFee";
import { sanitizePayuText } from "../../helpers/sanitizePayuText";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      throw new NotAuthenticatedError("Only students can purchase live tests.");
    }

    const json = superjson.parse<InputType>(await request.text());
    const { liveTestId, deepLinkUrl } = schema.parse(json);

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("PayU merchant key or salt is not configured.");
      throw new Error("Payment gateway is not configured.");
    }

    const payuFormData = await db.transaction().execute(async (trx) => {
      const liveTest = await trx
        .selectFrom("liveTests")
        .selectAll()
        .where("id", "=", liveTestId)
        .executeTakeFirst();

      if (!liveTest) {
        throw new Error("Live test not found.");
      }
      if (!liveTest.isActive) {
        throw new Error("This live test is no longer active.");
      }
      if (liveTest.endTime && new Date(liveTest.endTime) < new Date()) {
        throw new Error("This live test has already ended.");
      }
            // If registrationDeadline is set, enforce it; otherwise allow purchase until test ends
      if (liveTest.registrationDeadline && new Date(liveTest.registrationDeadline) < new Date()) {
        throw new Error("The registration deadline for this test has passed.");
      }
      if (liveTest.enrolledCount >= liveTest.maxSeats) {
        throw new Error("Sorry, all seats for this live test are filled.");
      }
      if (parseFloat(liveTest.price) <= 0) {
        throw new Error("This live test is free and does not require purchase. Please use the enroll endpoint.");
      }

      const existingEnrollment = await trx
        .selectFrom("liveTestEnrollments")
        .where("studentId", "=", user.id)
        .where("liveTestId", "=", liveTestId)
        .select("id")
        .executeTakeFirst();

      if (existingEnrollment) {
        throw new Error("You are already enrolled in this live test.");
      }

      // Cancel any previous pending orders for this specific live test by this user
      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .where("paymentTransactionId", "like", `live-test-${liveTestId}-%`)
        .execute();

      const txnid = `live-test-${liveTestId}-${nanoid(12)}`;
      const amount = parseFloat(liveTest.price).toFixed(2);
      const productInfo = liveTest.title.substring(0, 100);

      const newOrder = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          totalAmount: amount,
          status: "pending",
          paymentMethod: "payu",
          paymentTransactionId: txnid,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Look up the mock test's teacher to get the correct platform fee
      const mockTest = await trx
        .selectFrom("mockTests")
        .select("teacherId")
        .where("id", "=", liveTest.mockTestId)
        .executeTakeFirst();

      const platformFeePercentage = mockTest
        ? await getTeacherPlatformFee(mockTest.teacherId, trx)
        : 30;

      await trx
        .insertInto("orderItems")
        .values({
          orderId: newOrder.id,
          mockTestId: liveTest.mockTestId,
          priceAtPurchase: amount,
          platformFeePercentage: platformFeePercentage.toFixed(2),
        })
        .execute();

      const firstname = sanitizePayuText(user.displayName || "Student");
      const email = user.email ?? `${user.mobileNumber}@mail.testkart.in`;
      const sanitizedProductInfo = sanitizePayuText(productInfo);

      // udf1 carries the deep link URL for mobile app payment flow (same pattern as initiate_POST)
      const udf1 = deepLinkUrl ?? "";

      const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${sanitizedProductInfo}|${firstname}|${email}|${udf1}||||||||||${PAYU_MERCHANT_SALT}`;
      const hash = createHash("sha512").update(hashString).digest("hex");

      const payuUrl =
        PAYU_MODE !== "production"
          ? "https://test.payu.in/_payment"
          : "https://secure.payu.in/_payment";

      const responsePayload: OutputType = {
        key: PAYU_MERCHANT_KEY,
        txnid,
        amount,
        productinfo: sanitizedProductInfo,
        firstname,
        email,
        phone: "9999999999", // Default phone as per requirements
        surl: `https://testkart.in/_api/payment/payu/callback`,
        furl: `https://testkart.in/_api/payment/payu/callback`,
        hash,
        payuUrl,
        ...(udf1 ? { udf1 } : {}),
      };

      return responsePayload;
    });

    return new Response(superjson.stringify(payuFormData));
  } catch (error) {
    console.error("Failed to initiate live test purchase:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to initiate payment.",
        details: errorMessage,
      }),
      { status: 400 }
    );
  }
}