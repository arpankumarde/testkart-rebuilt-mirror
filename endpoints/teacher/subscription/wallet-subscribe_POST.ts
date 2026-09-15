import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./wallet-subscribe_POST.schema";
import superjson from "superjson";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import { refundOrphanedWalletSubscriptionPayment } from "../../../helpers/refundOrphanedWalletSubscriptionPayment";
import { createHash, randomUUID } from "crypto";
import { PAYU_MODE } from "../../../helpers/_publicConfigs";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (teacherRole === "manager") {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { planId, useWallet } = schema.parse(json);

    // a. Query platform_settings
    const setting = await db
      .selectFrom("platformSettings")
      .where("settingKey", "=", "subscription_payment_mode")
      .select("settingValue")
      .executeTakeFirst();
    
    if (setting?.settingValue === "recurring") {
      return new Response(superjson.stringify({ error: "Recurring payment mode is active. Please use the UPI Autopay flow." }), { status: 400 });
    }

    // b. Get plan
    const plan = await db
      .selectFrom("subscriptionPlans")
      .selectAll()
      .where("id", "=", planId)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!plan) {
      throw new Error("Invalid or inactive subscription plan.");
    }

    const planPrice = Number(plan.price);
    const isFree = planPrice === 0;

    // c. Free plan
    if (isFree) {
      await db.transaction().execute(async (trx) => {
        // Cancel any existing active subscriptions
        await trx
          .updateTable("teacherSubscriptions")
          .set({ status: "cancelled", updatedAt: new Date() })
          .where("teacherId", "=", effectiveTeacherId)
          .where("status", "=", "active")
          .execute();

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + plan.durationDays);

        await trx
          .insertInto("teacherSubscriptions")
          .values({
            teacherId: effectiveTeacherId,
            planId: plan.id,
            status: "active",
            startDate,
            endDate,
            paymentMethod: null,
            autoRenew: false,
          })
          .execute();
      });

      return new Response(superjson.stringify({ status: "completed" } satisfies OutputType));
    }

    // Calculate Wallet Balance
    let walletAmount = 0;
    if (useWallet) {
      const balanceInfo = await getTeacherAvailableBalance(effectiveTeacherId);
      walletAmount = Math.floor(balanceInfo.availableBalance * 100) / 100;
    }

    // d. Full wallet payment
    if (useWallet && walletAmount >= planPrice) {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("teacherSubscriptions")
          .set({ status: "cancelled", updatedAt: new Date() })
          .where("teacherId", "=", effectiveTeacherId)
          .where("status", "=", "active")
          .execute();

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + plan.durationDays);

        const [newSubscription] = await trx
          .insertInto("teacherSubscriptions")
          .values({
            teacherId: effectiveTeacherId,
            planId: plan.id,
            status: "active",
            startDate,
            endDate,
            paymentMethod: "wallet",
            autoRenew: false,
          })
          .returningAll()
          .execute();

        const txnid = `WALLET_${Date.now()}_${randomUUID().split("-")[0]}`;

        await trx
          .insertInto("subscriptionTransactions")
          .values({
            teacherId: effectiveTeacherId,
            planId: plan.id,
            subscriptionId: newSubscription.id,
            amount: plan.price,
            status: "completed",
            paymentMethod: "wallet",
            transactionId: txnid,
          })
          .execute();

        await trx
          .updateTable("users")
          .set({ isVerified: true })
          .where("id", "=", effectiveTeacherId)
          .execute();
      });

      return new Response(superjson.stringify({ status: "completed" } satisfies OutputType));
    }

    // e. Partial wallet or full PayU payment
    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      throw new Error("Payment gateway is not configured.");
    }

    let actualWalletDeducted = 0;
    let payuAmount = planPrice;
    let walletTxnId: string | undefined = undefined;

    const payuTxnId = `testkart-sub-${randomUUID()}`;

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("teacherSubscriptions")
        .set({ status: "cancelled", updatedAt: new Date() })
        .where("teacherId", "=", effectiveTeacherId)
        .where("status", "=", "active")
        .execute();

      // Before failing any stale pending PayU transactions from a previous
      // attempt, refund the wallet leg of any that were part of a
      // wallet+PayU split — otherwise a teacher who abandons a payment and
      // retries loses the wallet portion of the abandoned attempt for good.
      const stalePendingPayuTxns = await trx
        .selectFrom("subscriptionTransactions")
        .select("transactionId")
        .where("teacherId", "=", effectiveTeacherId)
        .where("status", "=", "pending")
        .where("paymentMethod", "=", "payu")
        .execute();

      for (const staleTxn of stalePendingPayuTxns) {
        if (staleTxn.transactionId) {
          await refundOrphanedWalletSubscriptionPayment(trx, effectiveTeacherId, staleTxn.transactionId);
        }
      }

      await trx
        .updateTable("subscriptionTransactions")
        .set({ status: "failed" })
        .where("teacherId", "=", effectiveTeacherId)
        .where("status", "=", "pending")
        .execute();

      if (useWallet && walletAmount > 0) {
        actualWalletDeducted = walletAmount;
        payuAmount = Number((planPrice - walletAmount).toFixed(2));
        walletTxnId = `WALLET_${Date.now()}_${randomUUID().split("-")[0]}`;

        await trx
          .insertInto("subscriptionTransactions")
          .values({
            teacherId: effectiveTeacherId,
            planId: plan.id,
            amount: String(actualWalletDeducted),
            status: "completed",
            paymentMethod: "wallet",
            transactionId: walletTxnId,
            notes: `Partial wallet payment mapped to PayU Txn: ${payuTxnId}`,
          })
          .execute();
      }

      await trx
        .insertInto("subscriptionTransactions")
        .values({
          teacherId: effectiveTeacherId,
          planId: plan.id,
          amount: String(payuAmount),
          status: "pending",
          paymentMethod: "payu",
          transactionId: payuTxnId,
        })
        .execute();
    });

    const productInfo = `Subscription for ${plan.name}`.substring(0, 100).replace(/\|/g, " ");
    const firstname = (user.displayName || "Teacher").replace(/\|/g, " ");
    const email = user.email || `${user.mobileNumber}@mail.testkart.in`;
    const udf1 = walletTxnId || "";
    const udf2 = "";
    const udf3 = "";
    const udf4 = "";
    const udf5 = "";
    const amountStr = payuAmount.toFixed(2);

    const hashString = `${PAYU_MERCHANT_KEY}|${payuTxnId}|${amountStr}|${productInfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${PAYU_MERCHANT_SALT}`;
    const hash = createHash("sha512").update(hashString).digest("hex");

    const payuUrl = PAYU_MODE !== "production"
      ? "https://test.payu.in/_payment"
      : "https://secure.payu.in/_payment";

    const callbackUrl = "https://testkart.in/_api/payment/payu/subscription/callback";

    return new Response(superjson.stringify({
      status: "payment_required",
      walletDeducted: actualWalletDeducted,
      payuData: {
        key: PAYU_MERCHANT_KEY,
        txnid: payuTxnId,
        amount: amountStr,
        productinfo: productInfo,
        firstname,
        email,
        phone: "9999999999",
        surl: callbackUrl,
        furl: callbackUrl,
        hash,
        payuUrl,
        udf1,
      }
    } satisfies OutputType));

  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 401 });
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: msg }), { status: 400 });
  }
}