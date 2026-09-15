import { db } from "./db";
import { sendPreDebitNotification, executeSITransaction } from "./payuSIApi";
import { extractPayUFailure } from "./extractPayUFailure";
import { sendEmail } from "./sendEmail";
import { subscriptionRenewed, subscriptionPaymentFailed, subscriptionCancelled } from "./emailTemplates";
import { getBrandedEmailHtml } from "./emailBaseTemplate";
import { nanoid } from "nanoid";
import { addDays, format } from "date-fns";
import { getTeacherAvailableBalance } from "./getTeacherAvailableBalance";

export async function subscriptionRenew(): Promise<void> {
  console.log("[subscriptionRenew] Starting scheduled job...");

  let preDebitsSent = 0;
  let chargesAttempted = 0;
  let chargesSucceeded = 0;
  let chargesFailed = 0;
  let chargesPending = 0;
  let subsExpired = 0;
  let walletRenewals = 0;
  let remindersSent = 0;

  const now = new Date();
  const next48Hours = addDays(now, 2);
  const next24Hours = addDays(now, 1);
  const next72Hours = addDays(now, 3);

  // Fetch payment mode setting
  const paymentModeSetting = await db
    .selectFrom("platformSettings")
    .select("settingValue")
    .where("settingKey", "=", "subscription_payment_mode")
    .executeTakeFirst();
    
  const paymentMode = paymentModeSetting?.settingValue || "normal";
  console.log(`[subscriptionRenew] Operating in ${paymentMode} mode`);

  if (paymentMode === "recurring") {
    // =========================================================================
    // Phase 1: Send pre-debit notifications (Recurring mode only)
    // =========================================================================
    console.log("[subscriptionRenew] Phase 1: Sending pre-debit notifications");

    try {
      const subscriptionsForPreDebit = await db
        .selectFrom("teacherSubscriptions")
        .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
        .select([
          "teacherSubscriptions.id",
          "teacherSubscriptions.mandateId",
          "subscriptionPlans.price",
        ])
        .where("teacherSubscriptions.status", "=", "active")
        .where("teacherSubscriptions.autoRenew", "=", true)
        .where("teacherSubscriptions.mandateStatus", "=", "active")
        .where("teacherSubscriptions.mandateId", "is not", null)
        .where("teacherSubscriptions.nextChargeDate", "is not", null)
        .where("teacherSubscriptions.nextChargeDate", "<=", next48Hours)
        .where("teacherSubscriptions.preDebitSentAt", "is", null)
        .execute();

      console.log(
        `[subscriptionRenew] Found ${subscriptionsForPreDebit.length} subscriptions for pre-debit`
      );

      for (const sub of subscriptionsForPreDebit) {
        if (!sub.mandateId) continue;

        try {
          const result = await sendPreDebitNotification({
            authPayuId: sub.mandateId,
            amount: sub.price,
          });

          if (result.success) {
            await db
              .updateTable("teacherSubscriptions")
              .set({ preDebitSentAt: new Date() })
              .where("id", "=", sub.id)
              .execute();
            preDebitsSent++;
          } else {
            console.error(
              `[subscriptionRenew] Pre-debit failed for sub ${sub.id}: ${result.message}`
            );
          }
        } catch (err) {
          console.error(
            `[subscriptionRenew] Exception during pre-debit for sub ${sub.id}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error("[subscriptionRenew] Failed during Phase 1:", err);
    }

    // =========================================================================
    // Phase 2: Execute charges (Recurring mode only)
    // =========================================================================
    console.log("[subscriptionRenew] Phase 2: Executing charges");

    try {
      const subscriptionsToCharge = await db
        .selectFrom("teacherSubscriptions")
        .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
        .innerJoin("users", "users.id", "teacherSubscriptions.teacherId")
        .select([
          "teacherSubscriptions.id",
          "teacherSubscriptions.mandateId",
          "teacherSubscriptions.teacherId",
          "teacherSubscriptions.planId",
          "teacherSubscriptions.endDate",
          "subscriptionPlans.name as planName",
          "subscriptionPlans.price",
          "subscriptionPlans.durationDays",
          "users.email",
          "users.displayName",
          "users.mobileNumber",
        ])
        .where("teacherSubscriptions.status", "=", "active")
        .where("teacherSubscriptions.autoRenew", "=", true)
        .where("teacherSubscriptions.mandateStatus", "=", "active")
        .where("teacherSubscriptions.mandateId", "is not", null)
        .where("teacherSubscriptions.nextChargeDate", "is not", null)
        .where("teacherSubscriptions.nextChargeDate", "<=", now)
        .where("teacherSubscriptions.preDebitSentAt", "is not", null)
        .execute();

      console.log(
        `[subscriptionRenew] Found ${subscriptionsToCharge.length} subscriptions to charge`
      );

      for (const sub of subscriptionsToCharge) {
        if (!sub.mandateId || !sub.email) continue;

        chargesAttempted++;
        const txnid = `testkart-charge-${nanoid(10)}`;
        let transactionId: number | undefined;

        try {
          // Create pending transaction record
          const insertedTx = await db
            .insertInto("subscriptionTransactions")
            .values({
              amount: sub.price,
              teacherId: sub.teacherId,
              planId: sub.planId,
              subscriptionId: sub.id,
              status: "pending",
              paymentMethod: "payu_recurring",
              transactionId: txnid,
            })
            .returning("id")
            .executeTakeFirst();

          if (!insertedTx) continue;
          transactionId = insertedTx.id;

          const amountStr = parseFloat(String(sub.price)).toFixed(2);

          // Execute payment intent
          const result = await executeSITransaction({
            authPayuId: sub.mandateId,
            txnid,
            amount: amountStr,
            email: sub.email,
            phone: sub.mobileNumber || "0000000000",
            firstname: sub.displayName || "User",
          });

          if (result.status === "captured") {
            chargesSucceeded++;

            const currentEndDate = sub.endDate ? new Date(sub.endDate) : now;
            const newEndDate = addDays(currentEndDate, sub.durationDays);

            // Update records within transaction scope
            await db.transaction().execute(async (trx) => {
              await trx
                .updateTable("teacherSubscriptions")
                .set({
                  endDate: newEndDate,
                  lastChargeDate: now,
                  nextChargeDate: newEndDate,
                  preDebitSentAt: null, // Reset for next cycle
                })
                .where("id", "=", sub.id)
                .execute();

              await trx
                .updateTable("subscriptionTransactions")
                .set({ status: "completed" })
                .where("id", "=", transactionId!)
                .execute();

              await trx
                .updateTable("users")
                .set({ isVerified: true })
                .where("id", "=", sub.teacherId)
                .execute();
            });

            // Dispatch confirmation email
            const template = subscriptionRenewed(
              sub.displayName,
              sub.planName,
              Number(sub.price),
              newEndDate
            );
            await sendEmail({
              to: sub.email,
              subject: template.subject,
              html: template.html,
              text: template.text,
            });

          } else if (result.status === "pending") {
            chargesPending++;
            console.log(`[subscriptionRenew] Transaction pending for sub ${sub.id}`);
          } else {
            // Handing payment failure scenarios
            chargesFailed++;

            await db
              .updateTable("subscriptionTransactions")
              .set({
                status: "failed",
                notes: result.message || "Payment failed",
                ...extractPayUFailure({ status: "failure", error_Message: result.message }),
              })
              .where("id", "=", transactionId)
              .execute();

            // Dispatch failure email
            const template = subscriptionPaymentFailed(
              sub.displayName,
              sub.planName,
              Number(sub.price)
            );
            await sendEmail({
              to: sub.email,
              subject: template.subject,
              html: template.html,
              text: template.text,
            });

            // Check consecutive failures
            const recentFailed = await db
              .selectFrom("subscriptionTransactions")
              .select(["id", "status"])
              .where("subscriptionId", "=", sub.id)
              .where("paymentMethod", "=", "payu_recurring")
              .orderBy("createdAt", "desc")
              .limit(3)
              .execute();

            if (
              recentFailed.length === 3 &&
              recentFailed.every((t) => t.status === "failed")
            ) {
              console.warn(
                `[subscriptionRenew] Sub ${sub.id} failed 3 times. Cancelling mandate.`
              );

              const freePlan = await db.selectFrom("subscriptionPlans").where("price", "=", "0").selectAll().executeTakeFirst();
              
              await db.transaction().execute(async (trx) => {
                await trx
                  .updateTable("teacherSubscriptions")
                  .set({
                    mandateStatus: "failed",
                    autoRenew: false,
                    status: "cancelled",
                    updatedAt: now,
                  })
                  .where("id", "=", sub.id)
                  .execute();

                if (freePlan) {
                  await trx
                    .insertInto("teacherSubscriptions")
                    .values({
                      teacherId: sub.teacherId,
                      planId: freePlan.id,
                      status: "active",
                      startDate: now,
                      autoRenew: false,
                      paymentMethod: "free",
                      createdAt: now,
                      updatedAt: now,
                    })
                    .execute();
                }

                await trx
                  .updateTable("users")
                  .set({
                    isVerified: false,
                    updatedAt: now,
                  })
                  .where("id", "=", sub.teacherId)
                  .execute();
              });

              const cancelTemplate = subscriptionCancelled(
                sub.displayName,
                sub.planName,
                sub.endDate ? new Date(sub.endDate) : now
              );
              await sendEmail({
                to: sub.email,
                subject: cancelTemplate.subject,
                html: cancelTemplate.html,
                text: cancelTemplate.text,
              });

              console.log(`[subscriptionRenew] Sub ${sub.id} cancelled after 3 failures. Teacher ${sub.teacherId} moved to Free Plan and unverified.`);
            }
          }
        } catch (err) {
          console.error(
            `[subscriptionRenew] Exception during charge for sub ${sub.id}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error("[subscriptionRenew] Failed during Phase 2:", err);
    }
  } else if (paymentMode === "normal") {
    // =========================================================================
    // Phase: Wallet Auto-Renewal (Normal mode only)
    // =========================================================================
    console.log("[subscriptionRenew] Phase: Wallet Auto-Renewal");
    try {
      const subscriptionsForWalletRenewal = await db
        .selectFrom("teacherSubscriptions")
        .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
        .innerJoin("users", "users.id", "teacherSubscriptions.teacherId")
        .select([
          "teacherSubscriptions.id",
          "teacherSubscriptions.teacherId",
          "teacherSubscriptions.planId",
          "teacherSubscriptions.endDate",
          "subscriptionPlans.name as planName",
          "subscriptionPlans.price",
          "subscriptionPlans.durationDays",
          "users.email",
          "users.displayName",
        ])
        .where("teacherSubscriptions.status", "=", "active")
        .where("teacherSubscriptions.autoRenew", "=", true)
        .where("subscriptionPlans.price", ">", "0")
        .where("teacherSubscriptions.endDate", "is not", null)
        .where("teacherSubscriptions.endDate", "<=", next24Hours)
        .execute();

      console.log(`[subscriptionRenew] Found ${subscriptionsForWalletRenewal.length} subscriptions for wallet renewal`);

      for (const sub of subscriptionsForWalletRenewal) {
        if (!sub.email) continue;
        chargesAttempted++;
        
        try {
          const balance = await getTeacherAvailableBalance(sub.teacherId);
          const price = Number(sub.price);
          
          if (balance.availableBalance >= price) {
            const currentEndDate = sub.endDate ? new Date(sub.endDate) : now;
            const newEndDate = addDays(currentEndDate, sub.durationDays);
            const txnid = `testkart-wallet-${nanoid(10)}`;
            
            await db.transaction().execute(async (trx) => {
              await trx
                .insertInto("subscriptionTransactions")
                .values({
                  amount: price,
                  teacherId: sub.teacherId,
                  planId: sub.planId,
                  subscriptionId: sub.id,
                  status: "completed",
                  paymentMethod: "wallet",
                  transactionId: txnid,
                })
                .execute();
                
              await trx
                .updateTable("teacherSubscriptions")
                .set({
                  endDate: newEndDate,
                  lastChargeDate: now,
                  nextChargeDate: newEndDate,
                  preDebitSentAt: null, // Reset for next cycle
                })
                .where("id", "=", sub.id)
                .execute();
                
              await trx
                .updateTable("users")
                .set({ isVerified: true })
                .where("id", "=", sub.teacherId)
                .execute();
            });
            
            walletRenewals++;
            chargesSucceeded++;
            
            const template = subscriptionRenewed(
              sub.displayName,
              sub.planName,
              price,
              newEndDate
            );
            await sendEmail({
              to: sub.email,
              subject: template.subject,
              html: template.html,
              text: template.text,
            });
            console.log(`[subscriptionRenew] Successfully renewed sub ${sub.id} via wallet.`);
          } else {
            console.log(`[subscriptionRenew] Wallet balance (${balance.availableBalance}) insufficient for sub ${sub.id} (Price: ${price}). Skipping.`);
            chargesFailed++;
          }
        } catch (err) {
          console.error(`[subscriptionRenew] Exception during wallet renewal for sub ${sub.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[subscriptionRenew] Failed during Wallet Auto-Renewal phase:", err);
    }
  }

  // =========================================================================
  // Phase 3: Expire overdue subscriptions (Both modes)
  // =========================================================================
  console.log("[subscriptionRenew] Phase 3: Expiring overdue subscriptions");

  try {
    let query = db
      .selectFrom("teacherSubscriptions")
      .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
      .innerJoin("users", "users.id", "teacherSubscriptions.teacherId")
      .select([
        "teacherSubscriptions.id",
        "teacherSubscriptions.teacherId",
        "teacherSubscriptions.endDate",
        "subscriptionPlans.name as planName",
        "users.email",
        "users.displayName",
      ])
      .where("teacherSubscriptions.status", "=", "active")
      .where("teacherSubscriptions.endDate", "is not", null)
      .where("teacherSubscriptions.endDate", "<", now);
      
    if (paymentMode === "recurring") {
      query = query.where((eb) => eb.or([
        eb("teacherSubscriptions.autoRenew", "=", false),
        eb("teacherSubscriptions.mandateStatus", "!=", "active"),
        eb("teacherSubscriptions.mandateId", "is", null)
      ]));
    }

    const overdueSubscriptions = await query.execute();

    console.log(
      `[subscriptionRenew] Found ${overdueSubscriptions.length} overdue subscriptions`
    );

    const freePlan = await db.selectFrom("subscriptionPlans").where("price", "=", "0").selectAll().executeTakeFirst();

    for (const sub of overdueSubscriptions) {
      if (!sub.email) continue;
      try {
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("teacherSubscriptions")
            .set({
              status: "expired",
              autoRenew: false,
              updatedAt: now,
            })
            .where("id", "=", sub.id)
            .execute();

          if (freePlan) {
            await trx
              .insertInto("teacherSubscriptions")
              .values({
                teacherId: sub.teacherId,
                planId: freePlan.id,
                status: "active",
                startDate: now,
                autoRenew: false,
                paymentMethod: "free",
                createdAt: now,
                updatedAt: now,
              })
              .execute();
          }

          await trx
            .updateTable("users")
            .set({ isVerified: false, updatedAt: now })
            .where("id", "=", sub.teacherId)
            .execute();
        });

        subsExpired++;

        const template = subscriptionCancelled(
          sub.displayName,
          sub.planName,
          sub.endDate ? new Date(sub.endDate) : now
        );
        await sendEmail({
          to: sub.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });

        console.log(`[subscriptionRenew] Auto-expired overdue sub ${sub.id} for teacher ${sub.teacherId}. Moved to Free Plan.`);
      } catch (err) {
        console.error(`[subscriptionRenew] Exception expiring sub ${sub.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[subscriptionRenew] Failed during Phase 3:", err);
  }

  // =========================================================================
  // Phase 4: Send expiry reminders (Normal mode only)
  // =========================================================================
  if (paymentMode === "normal") {
    console.log("[subscriptionRenew] Phase 4: Sending expiry reminders");
    try {
      const expiringSoon = await db
        .selectFrom("teacherSubscriptions")
        .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
        .innerJoin("users", "users.id", "teacherSubscriptions.teacherId")
        .select([
          "teacherSubscriptions.id",
          "teacherSubscriptions.teacherId",
          "teacherSubscriptions.endDate",
          "subscriptionPlans.name as planName",
          "subscriptionPlans.price",
          "users.email",
          "users.displayName",
        ])
        .where("teacherSubscriptions.status", "=", "active")
        .where("subscriptionPlans.price", ">", "0")
        .where("teacherSubscriptions.endDate", "is not", null)
        .where("teacherSubscriptions.endDate", "<=", next72Hours)
        .where("teacherSubscriptions.endDate", ">", now)
        .where("teacherSubscriptions.preDebitSentAt", "is", null)
        .execute();
        
      console.log(`[subscriptionRenew] Found ${expiringSoon.length} subscriptions for expiry reminder`);

      for (const sub of expiringSoon) {
        if (!sub.email || !sub.endDate) continue;
        
        try {
          const balance = await getTeacherAvailableBalance(sub.teacherId);
          const price = Number(sub.price);
          const canCover = balance.availableBalance >= price;
          
          const subject = `Your ${sub.planName} subscription is expiring soon`;
          const html = getBrandedEmailHtml({
            title: subject,
            icon: "⏰",
            accent: canCover ? "success" : "warning",
            heading: "Subscription Expiry Reminder",
            subheading: `Hi ${sub.displayName}`,
            bodyHtml: `
              <p style="margin:0;">Your <strong>${sub.planName}</strong> subscription is set to expire on <strong>${format(sub.endDate, "PPP")}</strong>.</p>
              <p style="margin:12px 0 0;font-weight:600;color:${canCover ? "#16A34A" : "#DC2626"};">${
                canCover
                  ? "Good news! Your wallet balance is sufficient to cover the renewal automatically."
                  : "Action required: your wallet balance is insufficient. Please top up or renew manually to keep your subscription active."
              }</p>
            `,
            table: [
              { label: "Renewal Cost", value: `₹${price.toFixed(2)}`, emphasize: true },
              { label: "Current Wallet Balance", value: `₹${balance.availableBalance.toFixed(2)}` },
            ],
            ctaLabel: "Manage Subscription",
            ctaUrl: "https://testkart.in/teacher/subscription",
          });

          await sendEmail({
            to: sub.email,
            subject,
            html,
            text: `Your ${sub.planName} subscription expires on ${format(sub.endDate, "PPP")}. Renewal cost: ₹${price.toFixed(2)}. Wallet balance: ₹${balance.availableBalance.toFixed(2)}.`,
          });
          
          await db
            .updateTable("teacherSubscriptions")
            .set({ preDebitSentAt: new Date() })
            .where("id", "=", sub.id)
            .execute();
            
          remindersSent++;
        } catch (err) {
          console.error(`[subscriptionRenew] Exception sending reminder for sub ${sub.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[subscriptionRenew] Failed during Phase 4:", err);
    }
  }

  console.log(`[subscriptionRenew] Summary:`);
  console.log(`  Mode: ${paymentMode}`);
  if (paymentMode === "recurring") {
    console.log(`  Pre-debits sent: ${preDebitsSent}`);
  }
  if (paymentMode === "normal") {
    console.log(`  Wallet renewals: ${walletRenewals}`);
    console.log(`  Reminders sent: ${remindersSent}`);
  }
  console.log(`  Charges attempted: ${chargesAttempted}`);
  console.log(`  Charges succeeded: ${chargesSucceeded}`);
  console.log(`  Charges failed: ${chargesFailed}`);
  if (paymentMode === "recurring") {
    console.log(`  Charges pending: ${chargesPending}`);
  }
  console.log(`  Subscriptions expired: ${subsExpired}`);
  console.log("[subscriptionRenew] Scheduled job completed.");
}