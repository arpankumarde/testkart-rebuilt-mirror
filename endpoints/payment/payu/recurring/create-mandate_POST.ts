import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./create-mandate_POST.schema";
import superjson from "superjson";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../../../helpers/_publicConfigs";
import { NotAuthenticatedError } from "../../../../helpers/getSetServerSession";
import { randomUUID } from "crypto";

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function handle(request: Request) {
  try {
    const baseUrl = "https://testkart.in";
    const { user } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized access. Only teachers can create mandates." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { planId } = schema.parse(json);

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("PayU merchant key or salt is not configured.");
      throw new Error("Payment gateway is not configured. Please contact support.");
    }

    const responsePayload = await db.transaction().execute(async (trx) => {
      const plan = await trx
        .selectFrom("subscriptionPlans")
        .selectAll()
        .where("id", "=", planId)
        .where("isActive", "=", true)
        .executeTakeFirst();

      if (!plan) {
        throw new Error("The selected subscription plan is not available.");
      }

      await trx
        .updateTable("subscriptionTransactions")
        .set({ status: "failed" })
        .where("teacherId", "=", user.id)
        .where("status", "=", "pending")
        .execute();

      const txnid = `testkart-mandate-${randomUUID()}`;
      const amount = parseFloat(plan.price).toFixed(2);

      await trx
        .insertInto("subscriptionTransactions")
        .values({
          teacherId: user.id,
          planId: plan.id,
          amount: plan.price,
          status: "pending",
          paymentMethod: "payu_recurring",
          transactionId: txnid,
        })
        .execute();

      const productInfo = `Mandate for ${plan.name}`.substring(0, 100).replace(/\|/g, " ");
      const firstname = (user.displayName || "Teacher").replace(/\|/g, " ");
      const email = user.email || `${user.mobileNumber}@mail.testkart.in`;

      const siStartDate = new Date();
      const siEndDate = new Date();
      siEndDate.setFullYear(siEndDate.getFullYear() + 5); // 5 years for flexibility

      const siDetails = {
        billingAmount: amount,
        billingCycle: plan.durationDays > 31 ? "YEARLY" : "MONTHLY",
        billingInterval: 1,
        paymentStartDate: formatDate(siStartDate),
        paymentEndDate: formatDate(siEndDate),
        billingCurrency: "INR",
      };

      const siDetailsJson = JSON.stringify(siDetails);

      const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${productInfo}|${firstname}|${email}|||||||||||${siDetailsJson}|${PAYU_MERCHANT_SALT}`;
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
        surl: `${baseUrl}/_api/payment/payu/recurring/mandate-callback`,
        furl: `${baseUrl}/_api/payment/payu/recurring/mandate-callback`,
        hash,
        payuUrl,
        si: "1",
        si_details: siDetailsJson,
      } satisfies OutputType;
    });

    return new Response(superjson.stringify(responsePayload));
  } catch (error) {
    console.error("Failed to create mandate:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(
        superjson.stringify({ error: "You must be logged in to create a mandate." }),
        { status: 401 }
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to initiate mandate creation.",
        details: errorMessage,
      }),
      { status: 400 }
    );
  }
}