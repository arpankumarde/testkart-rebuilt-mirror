import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./purchase_POST.schema";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../helpers/_publicConfigs";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      throw new Error("Payment gateway is not configured.");
    }

    const course = await db
      .selectFrom("courses")
      .select(["id", "title", "price", "status"])
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!course || course.status !== "published") {
      throw new Error("Course not found or not available for purchase.");
    }
    if (Number(course.price) <= 0) {
      throw new Error("This course is not a paid course.");
    }

    const txnid = `testkart-course-${nanoid(10)}`;
    const amount = Number(course.price).toFixed(2);
    const productInfo = course.title.substring(0, 100).replace(/\|/g, " ");
    const firstname = (user.displayName || "Student").replace(/\|/g, " ");
    const email = user.email ?? `${user.mobileNumber}@mail.testkart.in`;

    // Create a pending transaction record
    await db
      .insertInto("courseTransactions")
      .values({
        courseId: course.id,
        studentId: user.id,
        amount: amount,
        status: "pending",
        paymentMethod: "payu",
        payuTransactionId: txnid,
      })
      .execute();

    const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${productInfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
    const hash = createHash("sha512").update(hashString).digest("hex");

    const payuUrl =
      PAYU_MODE !== "production"
        ? "https://test.payu.in/_payment"
        : "https://secure.payu.in/_payment";

        // The callback URL needs to handle course payments specifically
    const callbackUrl = `https://testkart.in/_api/payment/payu/callback`;

    const responsePayload: OutputType = {
      key: PAYU_MERCHANT_KEY,
      txnid,
      amount,
      productinfo: productInfo,
      firstname,
      email,
      phone: "9999999999", // Placeholder
      surl: callbackUrl,
      furl: callbackUrl,
      hash,
      payuUrl,
    };

    return new Response(superjson.stringify(responsePayload));
  } catch (error) {
    console.error("Failed to initiate course payment:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to initiate payment", details: errorMessage }),
      { status: 500 }
    );
  }
}