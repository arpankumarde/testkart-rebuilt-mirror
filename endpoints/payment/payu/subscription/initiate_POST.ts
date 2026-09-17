import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./initiate_POST.schema";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../../../helpers/_publicConfigs";
import { NotAuthenticatedError } from "../../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized access. Only teachers can subscribe to plans." }),
        { status: 403 }
      );
    }
    if (teacherRole === "manager") {
      return new Response(
        superjson.stringify({ error: "Only account owners can access this feature" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { planId } = schema.parse(json);

    const baseUrl = "https://testkart.in";

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("PayU merchant key or salt is not configured.");
      throw new Error("Payment gateway is not configured. Please contact support.");
    }

    const responsePayload = await db.transaction().execute(async (trx) => {
      // Validate the subscription plan exists and is active
      const plan = await trx
        .selectFrom("subscriptionPlans")
        .selectAll()
        .where("id", "=", planId)
        .where("isActive", "=", true)
        .executeTakeFirst();

      if (!plan) {
        throw new Error("The selected subscription plan is not available. Please choose a different plan.");
      }

      // Cancel any existing pending subscription transactions for this teacher.
      // This prevents accumulation of multiple pending transactions when users retry payments.
      // Each payment attempt gets a fresh transaction ID, so old pending transactions are no longer valid.
      // We mark them as "failed" since TransactionStatus doesn't have "cancelled" - these represent
      // user-abandoned payment attempts rather than payment gateway failures.
      await trx
        .updateTable("subscriptionTransactions")
        .set({ status: "failed" })
        .where("teacherId", "=", user.id)
        .where("status", "=", "pending")
        .execute();

      const txnid = `testkart-sub-${nanoid(12)}`;

      await trx
        .insertInto("subscriptionTransactions")
        .values({
          teacherId: user.id,
          planId: plan.id,
          amount: plan.price,
          status: "pending",
          paymentMethod: "payu",
          transactionId: txnid,
        })
        .execute();

      const amount = parseFloat(plan.price).toFixed(2);
      const productInfo = `Testkart Subscription: ${plan.name}`.substring(0, 100).replace(/\|/g, " ");
      const firstname = (user.displayName || "Teacher").replace(/\|/g, " ");
      const email = user.email || "noreply@testkart.in";

      const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${productInfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
      const hash = createHash("sha512").update(hashString).digest("hex");

            const payuUrl =
        PAYU_MODE !== "production"
          ? "https://test.payu.in/_payment"
          : "https://secure.payu.in/_payment";

      return {
        key: PAYU_MERCHANT_KEY,
        txnid,
        amount,
        productinfo: productInfo,
        firstname,
        email,
        phone: "9999999999", // Default phone
                      surl: `${baseUrl}/_api/payment/payu/subscription/callback`,
      furl: `${baseUrl}/_api/payment/payu/subscription/callback`,
        hash,
        payuUrl,
      } satisfies OutputType;
    });

    return new Response(superjson.stringify(responsePayload));
  } catch (error) {
    console.error("Failed to initiate subscription payment:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(
        superjson.stringify({ error: "You must be logged in to subscribe to a plan." }),
        { status: 401 }
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to initiate payment.",
        details: errorMessage,
      }),
      { status: 400 }
    );
  }
}